/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 */

import async from 'async';

import { DB } from './DB';
import customUtils from './customUtils';
import { Index } from './indexes';
import model from './model';
import Storage from './storage';

/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 */

let storage;

let path = {
  join: function (...args) {
    return args.join('_');
  },
};

export class Persistence {
  public db: DB;
  public inMemoryOnly: boolean;
  public filename: string;
  public corruptAlertThreshold: any;
  public afterSerialization: any;
  public beforeDeserialization: any;
  public autocompactionIntervalId: any;

  constructor(options) {
    let i, j, randomString;

    this.db = options.db;
    this.inMemoryOnly = this.db.inMemoryOnly;
    this.filename = this.db.filename;
    this.corruptAlertThreshold = options.corruptAlertThreshold !== undefined ? options.corruptAlertThreshold : 0.1;
    storage = new Storage(this.db.storage);

    if (!this.inMemoryOnly && this.filename && this.filename.charAt(this.filename.length - 1) === '~') {
      throw new Error("The datafile name can't end with a ~, which is reserved for crash safe backup files");
    }

    // After serialization and before deserialization hooks with some basic sanity checks
    if (options.afterSerialization && !options.beforeDeserialization) {
      throw new Error(
        'Serialization hook defined but deserialization hook undefined, cautiously refusing to start aggio to prevent dataloss'
      );
    }
    if (!options.afterSerialization && options.beforeDeserialization) {
      throw new Error(
        'Serialization hook undefined but deserialization hook defined, cautiously refusing to start aggio to prevent dataloss'
      );
    }
    this.afterSerialization =
      options.afterSerialization ||
      function (s) {
        return s;
      };
    this.beforeDeserialization =
      options.beforeDeserialization ||
      function (s) {
        return s;
      };
    for (i = 1; i < 30; i += 1) {
      for (j = 0; j < 10; j += 1) {
        randomString = customUtils.uid(i);
        if (this.beforeDeserialization(this.afterSerialization(randomString)) !== randomString) {
          throw new Error(
            'beforeDeserialization is not the reverse of afterSerialization, cautiously refusing to start aggio to prevent dataloss'
          );
        }
      }
    }
  }

  persistCachedDatabase = (cb?) => {
    let callback = cb || function () {},
      toPersist = '',
      self = this;

    if (this.inMemoryOnly) {
      return callback(null);
    }

    this.db.getAllData().forEach(function (doc) {
      toPersist += self.afterSerialization(model.serialize(doc)) + '\n';
    });
    Object.keys(this.db.indexes).forEach(function (fieldName) {
      if (fieldName != '_id') {
        // The special _id index is managed by datastore.js, the others need to be persisted
        toPersist +=
          self.afterSerialization(
            model.serialize({
              $$indexCreated: {
                fieldName: fieldName,
                unique: self.db.indexes[fieldName].unique,
                sparse: self.db.indexes[fieldName].sparse,
              },
            })
          ) + '\n';
      }
    });

    storage.crashSafeWriteFile(this.filename, toPersist, function (err) {
      if (err) {
        return callback(err);
      }
      // self.db.emit('compaction.done'); // TODO
      return callback(null);
    });
  };

  compactDatafile = () => {
    return this.persistCachedDatabase();
  };

  setAutocompactionInterval = (interval) => {
    let self = this,
      minInterval = 5000,
      realInterval = Math.max(interval || 0, minInterval);

    this.stopAutocompaction();

    this.autocompactionIntervalId = setInterval(function () {
      self.compactDatafile();
    }, realInterval);
  };

  stopAutocompaction = () => {
    if (this.autocompactionIntervalId) {
      clearInterval(this.autocompactionIntervalId);
    }
  };

  persistNewState = (newDocs, cb) => {
    let self = this,
      toPersist = '',
      callback = cb || function () {};

    // In-memory only datastore
    if (self.inMemoryOnly) {
      return callback(null);
    }

    newDocs.forEach(function (doc) {
      toPersist += self.afterSerialization(model.serialize(doc)) + '\n';
    });

    if (toPersist.length === 0) {
      return callback(null);
    }

    storage.appendFile(self.filename, toPersist, 'utf8', function (err) {
      return callback(err);
    });
  };

  treatRawData = (rawData) => {
    let data = rawData.split('\n'),
      dataById: any = {},
      tdata: any[] = [],
      i,
      indexes = {},
      corruptItems = -1; // Last line of every data file is usually blank so not really corrupt

    for (i = 0; i < data.length; i += 1) {
      let doc;

      try {
        doc = model.deserialize(this.beforeDeserialization(data[i]));
        if (doc._id) {
          if (doc.$$deleted === true) {
            delete dataById[doc._id];
          } else {
            dataById[doc._id] = doc;
          }
        } else if (doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
          indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated;
        } else if (typeof doc.$$indexRemoved === 'string') {
          delete indexes[doc.$$indexRemoved];
        }
      } catch (e) {
        corruptItems += 1;
      }
    }

    // A bit lenient on corruption
    if (data.length > 0 && corruptItems / data.length > this.corruptAlertThreshold) {
      throw new Error(
        'More than ' +
          Math.floor(100 * this.corruptAlertThreshold) +
          '% of the data file is corrupt, the wrong beforeDeserialization hook may be used. Cautiously refusing to start aggio to prevent dataloss'
      );
    }

    Object.keys(dataById).forEach(function (k) {
      tdata.push(dataById[k]);
    });

    return { data: tdata, indexes: indexes };
  };

  loadDatabase = (cb) => {
    let callback = cb || function () {},
      self = this;

    self.db.resetIndexes();

    // In-memory only datastore
    if (self.inMemoryOnly) {
      return callback(null);
    }

    async.waterfall(
      [
        function (cb) {
          Persistence.ensureDirectoryExists(self.filename, function (err) {
            storage.ensureDatafileIntegrity(self.filename, function (err) {
              storage.readFile(self.filename, 'utf8', function (err, rawData) {
                if (err) {
                  return cb(err);
                }

                let treatedData;
                try {
                  treatedData = self.treatRawData(rawData);
                } catch (e) {
                  return cb(e);
                }

                // Recreate all indexes in the datafile
                Object.keys(treatedData.indexes).forEach(function (key) {
                  self.db.indexes[key] = new Index(treatedData.indexes[key]);
                });

                // Fill cached database (i.e. all indexes) with data
                try {
                  self.db.resetIndexes(treatedData.data);
                } catch (e) {
                  self.db.resetIndexes(); // Rollback any index which didn't fail
                  return cb(e);
                }

                self.db.persistence.persistCachedDatabase(cb);
              });
            });
          });
        },
      ],
      function (err) {
        if (err) {
          return callback(err);
        }

        // self.db.executor.processBuffer();
        return callback(null);
      }
    );
  };

  static ensureDirectoryExists = (dir, cb) => {
    let callback = cb || function () {};
    storage.mkdirp(dir, function (err) {
      return callback(err);
    });
  };

  static getNWAppFilename = (appName, relativeFilename) => {
    let home;

    switch (process.platform) {
      case 'win32':
      case 'darwin':
        home = process.env.HOME;
        if (!home) {
          throw new Error("Couldn't find the base application data directory");
        }
        home = path.join(home, 'Library', 'Application Support', appName);
        break;
      case 'linux':
        home = process.env.HOME;
        if (!home) {
          throw new Error("Couldn't find the base application data directory");
        }
        home = path.join(home, '.config', appName);
        break;
      default:
        throw new Error("Can't use the Node Webkit relative path for platform " + process.platform);
        break;
    }

    return path.join(home, 'aggio-data', relativeFilename);
  };
}
