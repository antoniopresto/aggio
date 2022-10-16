import { Hope } from 'hoper';

import { Query, Sort, TDocument } from './Operations';
import { SyncStorage } from './createSyncStorage';

export * from './Operations';

export interface AsyncStorage {
  getItem(key: string, callback?: (error?: Error, result?: string) => void): Promise<string | null>;
  setItem(key: string, value: string, callback?: (error?: Error) => void): Promise<void>;
  removeItem(key: string, callback?: (error?: Error) => void): Promise<void>;
}

export type DBOptions<Doc extends TDocument = TDocument> = {
  filename?: string;
  inMemoryOnly?: boolean;
  timestampData?: boolean;
  autoload?: boolean;
  onload?: Function;
  afterSerialization?: Function;
  beforeDeserialization?: Function;
  corruptAlertThreshold?: number;
  compareStrings?: Function;
  storage?: SyncStorage;
  docs?: DocInput<Doc>[] | Doc[];
};

export interface IndexOptions {
  fieldName: string;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

export interface UpdateOptions {
  multi?: boolean;
  upsert?: boolean;
  returnUpdatedDocs?: boolean;
}

export type UpdateResult<Doc = TDocument | TDocument[]> = {
  numAffected: number;
  upsert: boolean;
  updated: Doc | undefined;
};

export interface RemoveOptions {
  multi?: boolean;
}

export interface Cursor<Doc> extends Hope<Doc> {
  exec(): Promise<Doc>;
  skip(value: number): Cursor<Doc>;
  limit(value: number): Cursor<Doc>;
  sort(doc: Sort): Cursor<Doc>;
}

export type DocInput<Doc extends TDocument = TDocument> = {
  [K in keyof Doc as K extends '_id' ? never : K]: Doc[K];
} & { _id?: string };

export type Callback<T = void> = (err: Error | null, value: T) => void;
export type InsertCallback<Doc> = (err: Error | null, doc: Doc) => void;

export type CountCallback = (err: Error | null, count: number) => void;

export type FindCallback<Doc extends TDocument = TDocument> =
  //
  (err: Error | null, docs: Doc[]) => void;

export type FindOneCallback<Doc extends TDocument = TDocument> = (err: Error | null, doc: Doc | null) => void;

export type UpdateCallback<Doc extends TDocument = TDocument> = (err: Error | null, result?: UpdateResult<Doc>) => void;

export type Methods<Doc extends TDocument> = {
  loadDatabase(cb?: Callback): void;
  resetIndexes(newData: DocInput<Doc>[], cb?: Callback): void;
  ensureIndex(options: IndexOptions, cb?: Callback): void;
  removeIndex(fieldName: string, cb?: Callback): void;
  addToIndexes(doc: Doc, cb?: Callback): void;
  removeFromIndexes(doc: Doc, cb?: Callback): void;
  updateIndexes(oldDoc: Doc, newDoc: Doc, cb?: Callback): void;
  getCandidates(query: Query, dontExpireStaleDocs: boolean, cb?: Callback): void;
  createNewId(): string;
  getAllData(cb?: Callback<Doc[]>): Doc[];
};

export type IfSync<O, Res> = O extends any ? Res : Promise<Res>; // FIXME only sync for now
