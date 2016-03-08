let items = {};

module.exports = {
  AsyncStorage: {
    __reset: () => items = {},

    setItem: jest.fn((item, value, cb) => {
      return new Promise(resolve => {
        items[item] = value;
        cb(null, value);
        resolve(value);
      });
    }),
    multiSet: jest.fn((item, value, cb) => {
      return new Promise(resolve => {
        items[item] = value;
        cb(null, value);
        resolve(value);
      });
    }),
    getItem: jest.fn((item, cb) => {
      return new Promise(resolve => {
        const res = items[item];
        cb(null, res);
        resolve(res);
      });
    }),
    multiGet: jest.fn((item, cb) => {
      return new Promise(resolve => {
        const res = items[item];
        cb(null, res);
        resolve(res);
      });
    }),
    removeItem: jest.fn((item, cb) => {
      return new Promise(resolve => {
        const res = delete items[item];
        cb(null, res);
        resolve(res);
      });
    }),
    getAllKeys: jest.fn((items, cb) => {
      return new Promise(resolve => {
        const res = items.keys();
        cb(null, res);
        resolve(res);
      });
    })
  }
};
