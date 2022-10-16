import type { TemplateOptions } from 'lodash';
import camelCase from 'lodash/camelCase';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import kebabCase from 'lodash/kebabCase';
import lowerCase from 'lodash/lowerCase';
import lowerFirst from 'lodash/lowerFirst';
import snakeCase from 'lodash/snakeCase';
import startCase from 'lodash/startCase';
import template from 'lodash/template';
import templateSettings from 'lodash/templateSettings';
import upperCase from 'lodash/upperCase';
import upperFirst from 'lodash/upperFirst';

templateSettings.interpolate = /{([\s\S]+?)}/g;
export { get, template, TemplateOptions };

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
): T extends Record<string, any>
  ? T extends unknown
    ? { key: keyof T; value: T[keyof T]; original: T }
    : never
  : never {
  if (!item || typeof item !== 'object') throw new Error(`invalid object`);

  const list = Object.entries(item)[0];
  return {
    key: list?.[0],
    value: list?.[1],
    original: item,
  } as any;
}

export function isNullish<V>(value: V) {
  return value === '' || value === null || value === undefined;
}

export const stringCase = {
  capitalize,
  camelCase,
  camelcase: camelCase,
  kebabCase,
  kebabcase: kebabCase,
  snakeCase,
  snakecase: startCase,
  startCase,
  startcase: startCase,
  upperCase,
  uppercase: upperCase,
  upperFirst,
  upperfirst: upperFirst,
  lowerFirst,
  lowerfirst: lowerFirst,
  lowerCase,
  lowercase: lowerCase,
};

export const templateUtils = {
  ...stringCase,
  time: () => Date.now(),
  isoDate: () => new Date().toISOString(),
};
