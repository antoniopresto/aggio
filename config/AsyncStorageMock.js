let items = {};

module.exports = {
  __reset: () => (items = {}),

  setItem: (item, value, cb) => {
    items[item] = value;
    cb(null, value);
  },
  multiSet: (item, value, cb) => {
    items[item] = value;
    cb(null, value);
  },
  getItem: (item, cb) => {
    const res = items[item];
    cb(null, res);
  },
  multiGet: (item, cb) => {
    const res = items[item];
    cb(null, res);
  },
  removeItem: (item, cb) => {
    const res = delete items[item];
    cb(null, res);
  },
  getAllKeys: (items, cb) => {
    const res = items.keys();
    cb(null, res);
  }
};
