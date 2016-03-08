/**
 * Manage access to data, be it to find, update or remove it
 */
import _ from 'underscore';

import { DB } from './DB';
import { Query, Sort, TDocument } from './Operations';
import { Callback } from './interfaces';
import model from './model';
import { maybePromise } from './util';

/**
 * Create a new cursor for this collection
 * @param {DB} db - The datastore this cursor is bound to
 * @param {Query} query - The query this cursor will operate on
 * @param {Function} execFn - Handler to be executed after cursor has found the results and before the callback passed to find/findOne/update/remove
 */
export class Cursor<Doc extends TDocument = TDocument, ExecResult = any> {
  public db: DB<any>;
  sync: boolean;
  public query: any;
  public execFn: any;
  public _limit: any;
  public _skip: any;
  public _sort: any;
  public _projection: any;

  constructor(db: DB<any>, query?: Query<Doc>, execFn?) {
    this.db = db;
    this.sync = db.sync;
    this.query = query || {};
    if (execFn) {
      this.execFn = execFn;
    }
  }

  limit = (limit: number) => {
    this._limit = limit;
    return this;
  };

  skip = (skip: number) => {
    this._skip = skip;
    return this;
  };

  sort = (sortQuery: Sort) => {
    this._sort = sortQuery;
    return this;
  };

  project = (projection: TDocument) => {
    this._projection = projection;
    return this;
  };

  private _project = (candidates) => {
    let res: any[] = [] as any[],
      self = this,
      keepId,
      action,
      keys;

    if (this._projection === undefined || Object.keys(this._projection).length === 0) {
      return candidates;
    }

    keepId = this._projection._id === 0 ? false : true;
    this._projection = _.omit(this._projection, '_id');

    // Check for consistency
    keys = Object.keys(this._projection);
    keys.forEach(function (k) {
      if (action !== undefined && self._projection[k] !== action) {
        throw new Error("Can't both keep and omit fields except for _id");
      }
      action = self._projection[k];
    });

    // Do the actual projection
    candidates.forEach(function (candidate) {
      let toPush;
      if (action === 1) {
        // pick-type projection
        toPush = { $set: {} };
        keys.forEach(function (k) {
          toPush.$set[k] = model.getDotValue(candidate, k);
          if (toPush.$set[k] === undefined) {
            delete toPush.$set[k];
          }
        });
        toPush = model.modify({}, toPush);
      } else {
        // omit-type projection
        toPush = { $unset: {} };
        keys.forEach(function (k) {
          toPush.$unset[k] = true;
        });
        toPush = model.modify(candidate, toPush);
      }
      if (keepId) {
        toPush._id = candidate._id;
      } else {
        delete toPush._id;
      }
      res.push(toPush);
    });

    return res;
  };

  _exec(_callback?) {
    let res: any = [] as any[],
      added = 0,
      skipped = 0,
      self = this,
      error: any = null,
      i,
      keys,
      key;

    function callback(error, res?) {
      if (self.execFn) {
        self.execFn(error, res, _callback);
      } else {
        return _callback?.(error, res);
      }
    }

    self.db.getCandidates(self.query, function (err, candidates) {
      if (err) {
        return callback(err);
      }

      try {
        for (i = 0; i < candidates.length; i += 1) {
          if (model.match(candidates[i], self.query)) {
            // If a sort is defined, wait for the results to be sorted before applying limit and skip
            if (!self._sort) {
              if (self._skip && self._skip > skipped) {
                skipped += 1;
              } else {
                res.push(candidates[i]);
                added += 1;
                if (self._limit && self._limit <= added) {
                  break;
                }
              }
            } else {
              res.push(candidates[i]);
            }
          }
        }
      } catch (err) {
        return callback(err);
      }

      // Apply all sorts
      if (self._sort) {
        keys = Object.keys(self._sort);

        // Sorting
        let criteria: any[] = [] as any[];
        for (i = 0; i < keys.length; i++) {
          key = keys[i];
          criteria.push({ key: key, direction: self._sort[key] });
        }
        res.sort(function (a, b) {
          let criterion, compare, i;
          for (i = 0; i < criteria.length; i++) {
            criterion = criteria[i];
            compare =
              criterion.direction *
              model.compareThings(
                model.getDotValue(a, criterion.key),
                model.getDotValue(b, criterion.key),
                self.db.compareStrings
              );
            if (compare !== 0) {
              return compare;
            }
          }
          return 0;
        });

        // Applying limit and skip
        let limit = self._limit || res.length,
          skip = self._skip || 0;

        res = res.slice(skip, skip + limit);
      }

      // Apply projection
      try {
        res = self._project(res);
      } catch (e) {
        error = e;
        res = undefined;
      }

      return callback(error, res);
    });
  }

  exec = (cb?: Callback<ExecResult>): ExecResult => {
    return maybePromise(this, [cb], (callback) => {
      return this._exec(callback);
    });
  };
}
