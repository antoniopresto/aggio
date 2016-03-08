export function isError(obj) {
  return !!Object.prototype.toString.call(obj).match(/object \d*Error/);
}

export function isDate(obj) {
  return Object.prototype.toString.call(obj) === '[object Date]';
}

export function isRegExp(obj) {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
}

export function promiseWaterfall<T, CB extends (payload: T) => Promise<T>>(callbacks, initialArgs?: T): Promise<T> {
  // Don't assume we're running in an environment with promises
  return callbacks.reduce(function (accumulator, callback) {
    return accumulator.then(callback);
  }, Promise.resolve(initialArgs));
}

export function maybePromise(self: { sync: boolean }, args: any[], execute: Function) {
  const lastType = typeof args[args.length - 1];
  const callbackFromArgs = ['function', 'undefined'].includes(lastType) ? args.pop() : undefined;

  let payload;

  function callback(err, result) {
    if (!callbackFromArgs && err) throw err;
    payload = result;
    callbackFromArgs?.(err, result);
  }

  execute.apply(self, [...args, callback]);

  return payload;
}

export const tupleEnum = <T extends string[]>(
  ...values: T
): {
  readonly //
  [K in T[number]]: K;
} & (T[number] extends 'list' //
  ? {
      //
      __list: T[number][];
    }
  : {
      //
      list: T[number][];
    }) &
  (T[number] extends 'enum'
    ? {
        //
        __enum: T[number];
      }
    : {
        //
        enum: T[number];
      }) => {
  const en = values.reduce((p, n) => {
    return {
      ...p,
      [n]: n,
    };
  }, Object.create(null));

  Object.defineProperty(en, en.list !== undefined ? '__list' : 'list', {
    enumerable: false,
    value: values,
  });

  Object.defineProperty(en, en.enum !== undefined ? '__enum' : 'enum', {
    enumerable: false,
    get() {
      return values[0];
    },
  });

  return en;
};

export function getEntry<T extends Record<string, any>>(
  item: T
): T extends Record<string, any> ? (T extends unknown ? { k: keyof T; v: T[keyof T] } : never) : never {
  if (!item || typeof item !== 'object') throw new Error(`invalid object`);

  const list = Object.entries(item)[0];
  return {
    k: list?.[0],
    v: list?.[1],
  } as any;
}
