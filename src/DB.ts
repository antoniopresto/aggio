import util from 'util';

import async from 'async';
import intersection from 'underscore/modules/intersection';
import pluck from 'underscore/modules/pluck';

import { createSyncStorage } from './createSyncStorage';
import { Cursor } from './cursor';
import customUtils from './customUtils';
import { Index } from './indexes';
import {
  Aggregation,
  CountCallback,
  DBOptions,
  DocInput,
  FindCallback,
  FindOneCallback,
  IfSync,
  InsertCallback,
  Methods,
  Query,
  RemoveOptions,
  Sort,
  TDocument,
  UpdateCallback,
  UpdateDefinition,
  UpdateOptions,
  UpdateResult,
} from './interfaces';
import model from './model';
import { Persistence } from './persistence';
import { getEntry, maybePromise } from './util';

function _defaultConfig(): DBOptions {
  return { inMemoryOnly: false, autoload: true, storage: createSyncStorage() as any };
}

export class DB<Doc extends DocInput = DocInput, Opt extends DBOptions = any> implements Methods<Doc> {
  public inMemoryOnly: any;
  public autoload: any;
  public timestampData: any;
  public storage: any;
  public filename: any;
  public compareStrings: any;
  public persistence: Persistence;
  public indexes: Record<string, Index>;
  public ttlIndexes: any;
  public sync: boolean;

  constructor(options = _defaultConfig() as Opt) {
    options = { ..._defaultConfig(), ...options };

    let {
      docs,
      compareStrings,
      afterSerialization,
      beforeDeserialization,
      corruptAlertThreshold,
      onload, //
    } = options;

    const filename = options.filename;
    this.inMemoryOnly = options.inMemoryOnly || false;
    this.autoload = options.autoload || false;
    this.timestampData = options.timestampData || false;
    this.storage = options.storage;

    if (!(this.storage && this.storage.getItem && this.storage.setItem && this.storage.removeItem)) {
      throw new Error(
        `expected options.storage to be defined. \n--> received ${
          this.storage ? `object with keys: [${Object.getOwnPropertyNames(this.storage).join(', ')}]` : this.storage
        }`
      );
    }

    this.sync = true; // TODO

    // Determine whether in memory or persistent
    if (!filename || typeof filename !== 'string' || filename.length === 0) {
      this.filename = null;
      this.inMemoryOnly = true;
    } else {
      this.sync = false;
      this.filename = filename;
    }

    // String comparison function
    this.compareStrings = compareStrings;

    // Persistence handling
    this.persistence = new Persistence({
      db: this,
      afterSerialization: afterSerialization,
      beforeDeserialization: beforeDeserialization,
      corruptAlertThreshold: corruptAlertThreshold,
    });

    // This new executor is ready if we don't use persistence
    // If we do, it will only be ready once loadDatabase is called
    // this.executor = new Executor({ sync: this.sync });
    // if (this.inMemoryOnly) {
    //   this.executor.ready = true;
    // }

    // Indexed by field name, dot notation can be used
    // _id is always indexed and since _ids are generated randomly the underlying
    // binary is always well-balanced
    this.indexes = {};
    this.indexes._id = new Index({ fieldName: '_id', unique: true });
    this.ttlIndexes = {};

    // Queue a load of the database right away and call the onload handler
    // By default (no onload handler), if there is an error there, no operation will be possible so warn the user by throwing an exception
    if (this.autoload) {
      this.loadDatabase(
        // @ts-ignore // FIXME
        onload ||
          function (err) {
            if (err) {
              throw err;
            }
          }
      );
    }

    if (Array.isArray(docs)) {
      this.insert(docs as Doc[]);
    }
  }

  loadDatabase(cb) {
    return maybePromise(this, [cb], this.persistence.loadDatabase);
  }

  getAllData() {
    return this.indexes._id.getAll();
  }

  resetIndexes(newData?: DocInput<Doc>[]) {
    let self = this;

    Object.keys(this.indexes).forEach(function (i) {
      self.indexes[i].reset(newData);
    });
  }

  ensureIndex(options, cb?): any;
  ensureIndex(...args) {
    let [options, cb] = args;
    let callback = cb || function () {};
    options = options || {};

    return maybePromise(this, [options, callback], (options, callback) => {
      let err;

      if (!options.fieldName) {
        err = new Error('Cannot create an index without a fieldName');
        err.missingFieldName = true;
        return callback(err);
      }

      if (this.indexes[options.fieldName]) {
        return callback(null);
      }

      this.indexes[options.fieldName] = new Index(options);
      if (options.expireAfterSeconds !== undefined) {
        this.ttlIndexes[options.fieldName] = options.expireAfterSeconds;
      } // With this implementation index creation is not necessary to ensure TTL but we stick with MongoDB's API here

      try {
        this.indexes[options.fieldName].insert(this.getAllData());
      } catch (e) {
        delete this.indexes[options.fieldName];
        return callback(e);
      }

      // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
      this.persistence.persistNewState([{ $$indexCreated: options }], function (err) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    });
  }

  removeIndex(fieldName, cb?) {
    return maybePromise(this, [fieldName, cb], (fieldName, cb) => {
      let callback = cb || function () {};
      delete this.indexes[fieldName];

      this.persistence.persistNewState([{ $$indexRemoved: fieldName }], function (err) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    });
  }

  addToIndexes(doc) {
    let i,
      failingIndex,
      error,
      keys = Object.keys(this.indexes);

    for (i = 0; i < keys.length; i += 1) {
      try {
        this.indexes[keys[i]].insert(doc);
      } catch (e) {
        failingIndex = i;
        error = e;
        break;
      }
    }

    // If an error happened, we need to rollback the insert on all other indexes
    if (error) {
      for (i = 0; i < failingIndex; i += 1) {
        this.indexes[keys[i]].remove(doc);
      }

      throw error;
    }
  }

  removeFromIndexes(doc) {
    let self = this;

    Object.keys(this.indexes).forEach(function (i) {
      self.indexes[i].remove(doc);
    });
  }

  updateIndexes(oldDoc, newDoc?) {
    let i,
      failingIndex,
      error,
      keys = Object.keys(this.indexes);

    for (i = 0; i < keys.length; i += 1) {
      try {
        this.indexes[keys[i]].update(oldDoc, newDoc);
      } catch (e) {
        failingIndex = i;
        error = e;
        break;
      }
    }

    // If an error happened, we need to rollback the update on all other indexes
    if (error) {
      for (i = 0; i < failingIndex; i += 1) {
        this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
      }

      throw error;
    }
  }

  getCandidates(query, dontExpireStaleDocs, callback?);
  getCandidates(...args) {
    let [query, dontExpireStaleDocs, callback] = args;

    if (typeof dontExpireStaleDocs === 'function') {
      callback = dontExpireStaleDocs;
      dontExpireStaleDocs = false;
    }

    return maybePromise(this, [query, dontExpireStaleDocs, callback], (query, dontExpireStaleDocs, callback) => {
      let indexNames = Object.keys(this.indexes),
        self = this,
        usableQueryKeys;

      async.waterfall([
        // STEP 1: get candidates list by checking indexes from most to least frequent usecase
        function (cb) {
          // For a basic match
          usableQueryKeys = [] as any[];
          Object.keys(query).forEach(function (k) {
            if (
              typeof query[k] === 'string' ||
              typeof query[k] === 'number' ||
              typeof query[k] === 'boolean' ||
              util.isDate(query[k]) ||
              query[k] === null
            ) {
              usableQueryKeys.push(k);
            }
          });
          usableQueryKeys = intersection(usableQueryKeys, indexNames);
          if (usableQueryKeys.length > 0) {
            return cb(null, self.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]]));
          }

          // For a $in match
          usableQueryKeys = [] as any[];
          Object.keys(query).forEach(function (k) {
            if (query[k] && query[k].hasOwnProperty('$in')) {
              usableQueryKeys.push(k);
            }
          });
          usableQueryKeys = intersection(usableQueryKeys, indexNames);
          if (usableQueryKeys.length > 0) {
            return cb(null, self.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]].$in));
          }

          // For a comparison match
          usableQueryKeys = [] as any[];
          Object.keys(query).forEach(function (k) {
            if (
              query[k] &&
              (query[k].hasOwnProperty('$lt') ||
                query[k].hasOwnProperty('$lte') ||
                query[k].hasOwnProperty('$gt') ||
                query[k].hasOwnProperty('$gte'))
            ) {
              usableQueryKeys.push(k);
            }
          });
          usableQueryKeys = intersection(usableQueryKeys, indexNames);
          if (usableQueryKeys.length > 0) {
            return cb(null, self.indexes[usableQueryKeys[0]].getBetweenBounds(query[usableQueryKeys[0]]));
          }

          // By default, return all the DB data
          return cb(null, self.getAllData());
        },
        // STEP 2: remove all expired documents
        function (docs) {
          if (dontExpireStaleDocs) {
            return callback(null, docs);
          }

          let expiredDocsIds: any = [] as any[],
            validDocs: any = [] as any[],
            ttlIndexesFieldNames = Object.keys(self.ttlIndexes);

          docs.forEach(function (doc) {
            let valid = true;
            ttlIndexesFieldNames.forEach(function (i) {
              if (
                doc[i] !== undefined &&
                util.isDate(doc[i]) &&
                Date.now() > doc[i].getTime() + self.ttlIndexes[i] * 1000
              ) {
                valid = false;
              }
            });
            if (valid) {
              validDocs.push(doc);
            } else {
              expiredDocsIds.push(doc._id);
            }
          });

          async.eachSeries(
            expiredDocsIds,
            function (_id, cb) {
              self.remove({ _id: _id } as any, {}, function (err) {
                if (err) {
                  return callback(err);
                }
                return cb();
              });
            },
            function () {
              return callback(null, validDocs);
            }
          );
        },
      ]);
    });
  }

  createNewId() {
    let tentativeId = customUtils.uid(16);
    // Try as many times as needed to get an unused _id. As explained in customUtils, the probability of this ever happening is extremely small, so this is O(1)
    if (this.indexes._id.getMatching(tentativeId).length > 0) {
      tentativeId = this.createNewId();
    }
    return tentativeId;
  }

  prepareDocumentForInsertion(newDoc) {
    let preparedDoc,
      self = this;

    if (Array.isArray(newDoc)) {
      preparedDoc = [] as any[];
      newDoc.forEach(function (doc) {
        preparedDoc.push(self.prepareDocumentForInsertion(doc));
      });
    } else {
      preparedDoc = model.deepCopy(newDoc);
      if (preparedDoc._id === undefined) {
        preparedDoc._id = this.createNewId();
      }
      let now = new Date();
      if (this.timestampData && preparedDoc.createdAt === undefined) {
        preparedDoc.createdAt = now;
      }
      if (this.timestampData && preparedDoc.updatedAt === undefined) {
        preparedDoc.updatedAt = now;
      }
      model.checkObject(preparedDoc);
    }

    return preparedDoc;
  }

  _insertInCache(preparedDoc) {
    if (Array.isArray(preparedDoc)) {
      this._insertMultipleDocsInCache(preparedDoc);
    } else {
      this.addToIndexes(preparedDoc);
    }
  }

  _insertMultipleDocsInCache(preparedDocs) {
    let i, failingI, error;

    for (i = 0; i < preparedDocs.length; i += 1) {
      try {
        this.addToIndexes(preparedDocs[i]);
      } catch (e) {
        error = e;
        failingI = i;
        break;
      }
    }

    if (error) {
      for (i = 0; i < failingI; i += 1) {
        this.removeFromIndexes(preparedDocs[i]);
      }

      throw error;
    }
  }

  insert(doc: DocInput<Doc>, cb?: InsertCallback<Doc[]>): IfSync<Opt, Doc>;
  insert(doc: DocInput<Doc>[], cb?: InsertCallback<Doc[]>): IfSync<Opt, Doc[]>;
  insert(doc, cb) {
    return maybePromise(this, [doc, cb], (newDoc, cb) => {
      let callback = cb || function () {},
        preparedDoc;

      try {
        preparedDoc = this.prepareDocumentForInsertion(newDoc);
        this._insertInCache(preparedDoc);
      } catch (e) {
        return callback(e);
      }

      this.persistence.persistNewState(util.isArray(preparedDoc) ? preparedDoc : [preparedDoc], function (err) {
        if (err) {
          return callback(err);
        }
        return callback(null, model.deepCopy(preparedDoc));
      });
    });
  }

  count(query: Query<Doc>, callback?: CountCallback): IfSync<Opt, number>;
  count(query, cb) {
    return maybePromise(this, [query, cb], (query, callback) => {
      //
      let cursor = new Cursor<Doc>(this, query, function (err, docs, callback) {
        if (err) {
          return callback(err);
        }
        return callback(null, docs.length);
      });

      return cursor.exec(callback);
    });
  }

  find(query: Query<Doc>, projection?: TDocument | undefined): Cursor<Doc, IfSync<Opt, Doc[]>>;
  find(query: Query<Doc>, projection: TDocument, cb: FindCallback<Cursor<Doc, IfSync<Opt, Doc[]>>>): void;
  find(query: Query<Doc>, cb: FindCallback<Doc[]>): void;
  find(...args) {
    let [query, projection, callback] = args;

    switch (args.length) {
      case 1:
        projection = {};
        // callback is undefined, will return a cursor
        break;
      case 2:
        if (typeof projection === 'function') {
          callback = projection;
          projection = {};
        } // If not assume projection is an object and callback undefined
        break;
    }

    return maybePromise(this, [query, projection, callback], (query, projection, _callback) => {
      let cursor = new Cursor(this, query, function (err, docs, callback) {
        let res: any = [] as any[],
          i;

        if (err) {
          return callback(err);
        }

        for (i = 0; i < docs.length; i += 1) {
          res.push(model.deepCopy(docs[i]));
        }

        return callback(null, res);
      });
      cursor.project(projection);
      return callback ? cursor.exec(_callback) : _callback(null, cursor);
    });
  }

  findOne(query: Query<Doc>, cb: FindOneCallback<Cursor<Doc, IfSync<Opt, Doc | null>>>): void;
  findOne(query: Query): Cursor<Doc, IfSync<Opt, Doc | null>>;
  findOne(query: Query<Doc>, projection?: TDocument | undefined): Cursor<Doc, IfSync<Opt, Doc | null>>;
  findOne(...args) {
    let [query, projection, callback] = args;

    switch (args.length) {
      case 1:
        projection = {};
        // callback is undefined, will return a cursor
        break;
      case 2:
        if (typeof projection === 'function') {
          callback = projection;
          projection = {};
        } // If not assume projection is an object and callback undefined
        break;
    }

    return maybePromise(this, [query, projection, callback], (query, projection, _callback) => {
      let cursor = new Cursor(this, query, function (err, docs, callback) {
        if (err) {
          return callback(err);
        }
        if (docs.length === 1) {
          return callback(null, model.deepCopy(docs[0]));
        } else {
          return callback(null, null);
        }
      });
      cursor.project(projection).limit(1);
      return callback ? cursor.exec(_callback) : _callback(null, cursor);
    });
  }

  update(
    query: Query<Doc>,
    doc: UpdateDefinition<Doc>,
    options?: UpdateOptions,
    cb?: UpdateCallback<Doc>
  ): IfSync<Opt, UpdateResult<Doc>>;

  update(...args) {
    const self = this;

    let [query, updateQuery, options, cb] = args;

    if (typeof options === 'function') {
      cb = options;
      options = undefined;
    }

    options = options || _updateOptions();

    return maybePromise(this, [query, updateQuery, options, cb], (query, updateQuery, options, callback) => {
      const { multi, upsert } = options;
      let numReplaced = 0;

      async.waterfall([
        function (cb) {
          // If upsert option is set, check whether we need to insert the doc
          if (!upsert) {
            return cb();
          }

          // Need to use an internal function not tied to the executor to avoid deadlock
          let cursor = new Cursor(self as any, query as any);
          cursor.limit(1)._exec(function (err, docs) {
            if (err) {
              return callback(err);
            }
            if (docs.length === 1) {
              return cb();
            } else {
              let toBeInserted;

              try {
                model.checkObject(updateQuery);
                // updateQuery is a simple object with no modifier, use it as the document to insert
                toBeInserted = updateQuery;
              } catch (e) {
                // updateQuery contains modifiers, use the find query as the base,
                // strip it from all operators and update it according to updateQuery
                try {
                  toBeInserted = model.modify(model.deepCopy(query, true), updateQuery);
                } catch (err: any) {
                  return callback(err);
                }
              }

              return self.insert(toBeInserted, function (err, newDoc) {
                if (err) {
                  return callback(err);
                }
                return callback(null, { numAffected: 1, updated: newDoc, upsert: true });
              });
            }
          });
        },

        function () {
          // Perform the update
          let modifiedDoc,
            modifications: any = [] as any[],
            createdAt;

          self.getCandidates(query, function (err, candidates) {
            if (err) {
              return callback(err);
            }

            // Preparing update (if an error is thrown here neither the datafile nor
            // the in-memory indexes are affected)
            try {
              for (let i = 0; i < candidates.length; i += 1) {
                if (model.match(candidates[i], query) && (multi || numReplaced === 0)) {
                  numReplaced += 1;
                  if (self.timestampData) {
                    createdAt = candidates[i].createdAt;
                  }
                  modifiedDoc = model.modify(candidates[i], updateQuery);
                  if (self.timestampData) {
                    modifiedDoc.createdAt = createdAt;
                    modifiedDoc.updatedAt = new Date();
                  }
                  modifications.push({
                    oldDoc: candidates[i],
                    newDoc: modifiedDoc,
                  });
                }
              }
            } catch (err: any) {
              return callback(err);
            }

            // Change the docs in memory
            try {
              self.updateIndexes(modifications);
            } catch (err: any) {
              return callback(err);
            }

            // Update the datafile
            let updatedDocs = pluck(modifications, 'newDoc');
            self.persistence.persistNewState(updatedDocs, function (err) {
              if (err) {
                return callback(err);
              }
              if (!options.returnUpdatedDocs) {
                return callback(null, { numAffected: numReplaced, upsert, updated: undefined });
              } else {
                let updatedDocsDC: any = [] as any[];
                updatedDocs.forEach(function (doc) {
                  updatedDocsDC.push(model.deepCopy(doc));
                });
                if (!multi) {
                  updatedDocsDC = updatedDocsDC[0];
                }
                return callback(null, { numAffected: numReplaced, updated: updatedDocsDC, upsert });
              }
            });
          });
        },
      ]);
    });
  }

  remove(query: Query<Doc>, options?: RemoveOptions, cb?: FindOneCallback<Doc>): IfSync<Opt, number>;
  remove(...args) {
    let [query, options = {}, cb] = args;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    return maybePromise(this, [query, options, cb], (query, options, cb) => {
      let callback,
        self = this,
        numRemoved = 0,
        removedDocs: any = [] as any[],
        multi = options.multi !== undefined ? options.multi : false;

      callback = cb || function () {};

      this.getCandidates(query, true, function (err, candidates) {
        if (err) {
          return callback(err);
        }

        try {
          candidates.forEach(function (d) {
            if (model.match(d, query) && (multi || numRemoved === 0)) {
              numRemoved += 1;
              removedDocs.push({ $$deleted: true, _id: d._id });
              self.removeFromIndexes(d);
            }
          });
        } catch (err) {
          return callback(err);
        }

        self.persistence.persistNewState(removedDocs, function (err) {
          if (err) {
            return callback(err);
          }
          return callback(null, numRemoved);
        });
      });
    });
  }
}

export function aggio<Doc extends TDocument>(
  input: DB<Doc> | DBOptions<Doc> | Doc[],
  aggregation: Aggregation<Doc> | Aggregation<any>
) {
  const db =
    'loadDatabase' in input
      ? createDB({ docs: input.getAllData() })
      : Array.isArray(input)
      ? createDB({ docs: input })
      : createDB(input);

  const operations = aggregation.map((operation) => getEntry(operation));
  const ops: { op: typeof operations[number]; res: any }[] = [];

  function getKeyValue(item: TDocument, key: string | number) {
    const el = aggio([item], [{ $project: { [key]: 1 } }, { $matchOne: {} }]);
    const keyValue = Object.values(el)[0];
    const tof = typeof keyValue;
    if (!['number', 'string'].includes(tof)) throw new Error(`invalid type of key ${tof}`);
    return `${keyValue}`;
  }

  let lastSort: Sort = { _id: -1 };

  operations.forEach((op) => {
    switch (op.k) {
      case '$update': {
        const { $match = {}, $multi = true, $upsert = false, ...update } = op.v;
        db.update($match, update, { multi: $multi, upsert: $upsert });
        ops.push({ res: db.find({}).sort(lastSort).exec(), op });
        break;
      }
      case '$matchOne': {
        const item = db.findOne(op.v).exec();
        ops.push({ res: item, op });
        if (item) {
          db.resetIndexes([item]);
        }
        break;
      }
      case '$limit': {
        const items = db.find({}).sort(lastSort).limit(op.v).exec();
        db.resetIndexes(items);
        ops.push({ res: items, op });
        break;
      }
      case '$sort': {
        lastSort = op.v;
        const items = db.find({}).sort(op.v).exec();
        db.resetIndexes(items);
        ops.push({ res: items, op });
        break;
      }
      case '$match': {
        const items = db.find(op.v).sort(lastSort).exec();
        db.resetIndexes(items);
        ops.push({ res: items, op });
        break;
      }
      case '$project': {
        const items = db.find({}).sort(lastSort).project(op.v).exec();
        db.resetIndexes(items);
        ops.push({ res: items, op });
        break;
      }
      case '$groupBy': {
        const group: Record<string, any[]> = {};
        const items = db.find(op.v).sort(lastSort).exec();

        const key = Object.keys(op.v)[0];

        items.forEach((el) => {
          const keyValue = getKeyValue(el, key);
          group[keyValue] = group[keyValue] || [];
          group[keyValue].push(el);
        });

        db.resetIndexes([group]);
        ops.push({ res: group, op });
        break;
      }
      case '$keyBy': {
        const $onMany = op.v.$onMany;
        const group: Record<string, { value: any; asList?: boolean }> = {};
        const items = db.find(op.v).sort(lastSort).exec();

        const key = Object.keys(op.v)[0];

        items.forEach((el) => {
          const keyValue = getKeyValue(el, key);

          if (group.hasOwnProperty(keyValue)) {
            const msg = `found multiple items with key ${keyValue}`;
            switch ($onMany) {
              case 'list': {
                const { value, asList } = group[keyValue];
                if (asList) {
                  group[keyValue].value.push(el);
                } else {
                  group[keyValue].asList = true;
                  group[keyValue].value = [value, el];
                }
                break;
              }
              case 'last': {
                group[keyValue].value = el;
                break;
              }
              case 'warn': {
                console.warn(msg);
                break;
              }
              case 'first': {
                break;
              }
              default: {
                throw new Error(msg);
              }
            }
            return;
          }

          group[keyValue] = { value: el };
        });

        const res = Object.entries(group).reduce(
          (acc, [k, v]) => ({
            //
            ...acc,
            [k]: v.value,
          }),
          {}
        );

        db.resetIndexes([res]);
        ops.push({ res: res, op });
        break;
      }
    }
  });

  return ops[ops.length - 1]?.res;
}

export function createDB<Doc extends TDocument, O extends DBOptions>(options?: O): DB<Doc> {
  return new DB(options);
}

function _updateOptions(): Required<UpdateOptions> {
  return {
    multi: false,
    returnUpdatedDocs: true,
    upsert: false,
  };
}
