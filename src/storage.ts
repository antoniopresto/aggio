export default class Storage {
  public storage: any;
  public crashSafeWriteFile: any;

  constructor(storage) {
    this.storage = storage;
    this.crashSafeWriteFile = this.writeFile;
  }

  exists = (filename, callback) => {
    this.storage.getItem(filename, (err, value) => {
      if (value !== null) {
        return callback(true);
      } else {
        return callback(false);
      }
    });
  };

  rename = (filename, newFilename, callback) => {
    this.storage.getItem(filename, (err, value) => {
      if (value === null) {
        this.storage.removeItem(newFilename, callback);
      } else {
        this.storage.setItem(newFilename, value, () => {
          this.storage.removeItem(filename, callback);
        });
      }
    });
  };

  writeFile = (filename, contents, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    this.storage.setItem(filename, contents, callback);
  };

  appendFile = (filename, toAppend, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }

    this.storage.getItem(filename, (err, contents) => {
      contents = contents || '';
      contents += toAppend;
      this.storage.setItem(filename, contents, callback);
    });
  };

  readFile = (filename, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    this.storage.getItem(filename, (err, contents) => {
      return callback(null, contents || '');
    });
  };

  unlink = (filename, callback) => {
    this.storage.removeItem(filename, callback);
  };

  mkdirp = (dir, callback) => {
    return callback();
  };

  ensureDatafileIntegrity = (filename, callback) => {
    return callback(null);
  };
}
