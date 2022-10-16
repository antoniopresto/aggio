# Aggio

> Aggregation utility for objects like in MongoDB

## Installation

```
npm install aggio --save    # Put latest version in your package.json
```

```ts
import { aggio, createDB, DB } from 'aggio';
describe('DB', () => {
  let db: DB<{ name: string }>;

  beforeEach(async () => (db = createDB()));

  const Antonio = { name: 'Antonio' };
  const Rafaela = { name: 'Rafaela' };
  const users = [Antonio, Rafaela];

  describe('aggio', () => {
    test('$matchOne', () => {
      const sut = aggio(users, [{ $matchOne: { name: 'Antonio' } }]);
      expect(sut).toMatchObject(Antonio);
    });

    test('$template', () => {
      const sut = aggio<{ name: string; address?: { street: string } }>(
        [
          {
            name: 'Antonio',
            address: {
              street: 'Rua',
            },
          },
          {
            name: 'Rafaela',
            address: {
              street: 'Avenida',
            },
          },
        ],
        [
          { $sort: { name: -1 } }, //
          { $template: '{name}#{lowercase(address.street)}' },
          { $first: 1 },
          { $limit: 10 },
        ]
      );

      expect(sut).toEqual('Rafaela#av');
    });

    test('$keyBy:{ $pick }', () => {
      const sut = aggio<{ name: string }>(users, [
        { $keyBy: { $pick: 'name' } },
        { $sort: { name: -1 } }, //
        { $matchOne: {} },
      ]);

      expect(sut).toMatchObject({
        Antonio,
        Rafaela,
      });
    });

    test('$keyBy:{ $pick: `field.subField` }', () => {
      const sut = aggio<{ name: string; address?: { street: string } }>(
        [
          {
            name: 'Antonio',
            address: {
              street: 'Rua',
            },
          },
          {
            name: 'Rafaela',
            address: {
              street: 'Avenida',
            },
          },
          {
            name: 'Goat',
          },
        ],
        [
          { $keyBy: { $pick: { $join: ['name', '##', 'address.street'], $stringify: 'snakeCase' } } },
          { $sort: { name: -1 } }, //
          { $matchOne: {} },
        ]
      );

      expect(sut).toEqual({
        'rafaela#avenida': {
          _id: expect.any(String),
          address: {
            street: 'Avenida',
          },
          name: 'Rafaela',
        },
        'antonio#rua': {
          _id: expect.any(String),
          address: {
            street: 'Rua',
          },
          name: 'Antonio',
        },
      });
    });

    test('$keyBy:{ $pick: $template }', () => {
      const sut = aggio<{ name: string; address?: { street: string } }>(
        [
          {
            name: 'Antonio',
            address: {
              street: 'Rua',
            },
          },
          {
            name: 'Rafaela',
            address: {
              street: 'Avenida',
            },
          },
          {
            name: 'Goat',
          },
        ],
        [
          { $match: { 'address.street': { $exists: true } } },
          {
            $keyBy: {
              $pick: { $join: ['address'], $stringify: { $template: `{uppercase(name)}#{lowercase(street)}` } },
            },
          },
          { $sort: { name: -1 } }, //
          { $matchOne: {} },
        ]
      );

      expect(sut).toEqual({
        'ANTONIO#rua': {
          _id: expect.any(String),
          address: {
            street: 'Rua',
          },
          name: 'Antonio',
        },
        'RAFAELA#avenida': {
          _id: expect.any(String),
          address: {
            street: 'Avenida',
          },
          name: 'Rafaela',
        },
      });
    });

    test('$groupBy with $sort and $update', () => {
      const sut = aggio<{ name: string; age?: number }>(
        [
          ...users,
          {
            name: 'Antonio',
            age: 55,
          },
        ],
        [
          {
            $update: {
              $match: { age: { $exists: false } },
              $inc: { age: 20 },
            },
          },
          { $sort: { name: -1, age: -1 } },
          {
            $groupBy: { name: { $exists: true } },
          },
          { $matchOne: {} },
        ]
      );

      expect(sut).toEqual({
        Antonio: [
          {
            _id: expect.any(String),
            age: 55,
            name: 'Antonio',
          },
          {
            _id: expect.any(String),
            age: 20,
            name: 'Antonio',
          },
        ],
        Rafaela: [
          {
            _id: expect.any(String),
            age: 20,
            name: 'Rafaela',
          },
        ],
      });
    });

    test('$pick with $sort and $update', () => {
      const sut = aggio<{ name: string; age?: number }>(
        [
          ...users,
          {
            name: 'Antonio',
            age: 55,
          },
        ],
        [
          {
            $update: {
              $match: { age: { $exists: false } },
              $inc: { age: 20 },
            },
          },
          { $sort: { name: -1, age: -1 } },
          { $pick: 'name' },
        ]
      );

      expect(sut).toEqual('Rafaela');
    });

    test('$pick $join', () => {
      const sut = aggio<{ name: string; age?: number; address?: { street?: string } }>(
        [
          {
            name: 'Antonio',
            address: {
              street: 'Rua',
            },
          },
          {
            name: 'Rafaela',
            address: {
              street: 'Avenida',
            },
          },
        ],
        [
          { $match: { 'address.street': { $exists: true } } }, //
          { $sort: { name: -1, age: -1 } }, //
          { $pick: { $join: ['name', '##', 'address.street'] } },
        ]
      );

      expect(sut).toEqual('Rafaela#Avenida');
    });

    test('$pick $joinEach', () => {
      const sut = aggio<{ name: string; age?: number; address?: { street?: string } }>(
        [
          {
            name: 'Antonio',
            address: {
              street: 'Rua',
            },
          },
          {
            name: 'Rafaela',
            address: {
              street: 'Avenida',
            },
          },
        ],
        [
          { $match: { 'address.street': { $exists: true } } }, //
          { $sort: { name: -1, age: -1 } }, //
          { $pick: { $joinEach: ['name', '##', 'address.street'] } },
        ]
      );

      expect(sut).toEqual(['Rafaela#Avenida', 'Antonio#Rua']);
    });

    test('$pick $each', () => {
      const sut = aggio<{ name: string; age?: number; address?: { street?: string } }>(
        [
          ...users,
          {
            name: 'Antonio',
            age: 55,
            address: {
              street: 'Rua',
            },
          },
        ],
        [
          {
            $update: {
              $match: { age: { $exists: false } },
              $inc: { age: 20 },
            },
          },
          { $sort: { name: -1, age: -1 } },
          { $pick: { $each: 'name' } },
        ]
      );

      expect(sut).toEqual(['Rafaela', 'Antonio', 'Antonio']);
    });

    test('$match with $sort', () => {
      const sut = aggio(users, [{ $match: { name: { $exists: true } } }, { $sort: { name: 1 } }]);
      expect(sut).toMatchObject([{ name: 'Antonio' }, { name: 'Rafaela' }]);
    });

    test('$keyBy with $sort', () => {
      const sut = aggio<{ name: string }>(users, [
        { $keyBy: { name: { $exists: true } } },
        { $sort: { name: -1 } }, //
        { $matchOne: {} },
      ]);

      expect(sut).toMatchObject({
        Antonio,
        Rafaela,
      });
    });
  });

  describe('DB methods', () => {
    test('db.insert', async () => {
      const sut = db.insert(users);

      expect(sut).toEqual([
        {
          _id: expect.any(String),
          name: 'Antonio',
        },
        {
          _id: expect.any(String),
          name: 'Rafaela',
        },
      ]);
    });

    test('db.update', async () => {
      db.insert(users);
      const sut = db.update({ name: /ant/i }, { $inc: { age: 1 } });

      expect(sut).toEqual({
        numAffected: 1,
        updated: expect.objectContaining({
          ...Antonio,
          age: 1,
        }),
        upsert: false,
      });
    });

    test('db.count', async () => {
      db.insert(users);
      const sut = db.count({ name: /ant/i });
      expect(sut).toEqual(1);
    });

    test('db.find', async () => {
      db.insert(users);
      const sut = db.find({ name: /ant/i }).exec();
      expect(sut).toEqual([expect.objectContaining(Antonio)]);
    });

    test('db.findOne', async () => {
      db.insert(users);
      const sut = db.findOne({ name: /ant/i }).exec();
      expect(sut).toMatchObject(Antonio);
    });

    test('db.remove', async () => {
      db.insert(users);
      const sut = db.remove({ name: /ant/i });
      expect(sut).toEqual(1);
    });
  });
});
```

```typescript

export type TemplateDefinition = { $template: string; options?: TemplateOptions };
export type StringifyDefinition = keyof typeof stringCase | TemplateDefinition;

export type PickDefinition<TSchema> = {
  $pick:
    | DotNotations<TSchema>
    | { $join: (DotNotations<TSchema> | `#${string | number}`)[]; $stringify?: StringifyDefinition }
    | { $joinEach: (DotNotations<TSchema> | `#${string | number}`)[]; $stringify?: StringifyDefinition }
    | { $each: DotNotations<TSchema> | DotNotations<TSchema>[]; $stringify?: StringifyDefinition };
};

export type AggregationOperator<TSchema> =
  | { $first: true | 1 }
  | { $last: true | 1 }
  | { $update: UpdateDefinition<TSchema> & { $match?: Query<TSchema>; $multi?: boolean; $upsert?: boolean } }
  | { $matchOne: Query<TSchema> }
  | { $limit: number }
  | { $sort: Sort }
  | { $match: Query<TSchema> }
  | { $project: TDocument }
  | { $groupBy: GroupByDefinition<TSchema> }
  | { $keyBy: KeyByDefinition<TSchema> }
  | PickDefinition<TSchema>
  | TemplateDefinition;

export type GroupByDefinition<TSchema> = {
  [Property in Join<NestedPaths<WithId<TSchema>>, '.'> as PropertyType<TSchema, Property> extends number | string
    ? Property
    : never]?: PropertyType<WithId<TSchema>, Property> | Condition<PropertyType<WithId<TSchema>, Property>>;
};

export type KeyByDefinition<TSchema extends any = { _id?: string }> = (
  | {
      [Property in Join<NestedPaths<WithId<TSchema>>, '.'> as PropertyType<TSchema, Property> extends number | string
        ? Property
        : never]?: PropertyType<WithId<TSchema>, Property> | Condition<PropertyType<WithId<TSchema>, Property>>;
    }
  | PickDefinition<TSchema>
) & {
  $onMany?: 'first' | 'last' | 'error' | 'warn' | 'list';
};

// Some Types from The official MongoDB driver for Node.js
export type Query<TSchema = TDocument> =
  | Partial<TSchema>
  | ({
      [Property in Join<NestedPaths<WithId<TSchema>>, '.'>]?: Condition<PropertyType<WithId<TSchema>, Property>>;
    } & RootFilterOperators<WithId<TSchema>>);

export type Join<T extends unknown[], D extends string> = T extends []
  ? ''
  : T extends [string | number]
  ? `${T[0]}`
  : T extends [string | number, ...infer R]
  ? `${T[0]}${D}${Join<R, D>}`
  : string;

export interface TDocument {
  [key: string]: any;
}

export declare type NestedPaths<Type> = Type extends string | number | boolean | Date | RegExp
  ? []
  : Type extends ReadonlyArray<infer ArrayType>
  ? [] | [number, ...NestedPaths<ArrayType>]
  : Type extends object
  ? {
      [Key in Extract<keyof Type, string>]: Type[Key] extends Type
        ? [Key]
        : Type extends Type[Key]
        ? [Key]
        : Type[Key] extends ReadonlyArray<infer ArrayType>
        ? Type extends ArrayType
          ? [Key]
          : ArrayType extends Type
          ? [Key]
          : [Key, ...NestedPaths<Type[Key]>] // child is not structured the same as the parent
        : [Key, ...NestedPaths<Type[Key]>] | [Key];
    }[Extract<keyof Type, string>]
  : [];

export type DotNotations<T> = Join<NestedPaths<T>, '.'>;

export type PropertyType<Type, Property extends string> = string extends Property
  ? unknown
  : Property extends keyof Type
  ? Type[Property]
  : Property extends `${number}`
  ? Type extends ReadonlyArray<infer ArrayType>
    ? ArrayType
    : unknown
  : Property extends `${infer Key}.${infer Rest}`
  ? Key extends `${number}`
    ? Type extends ReadonlyArray<infer ArrayType>
      ? PropertyType<ArrayType, Rest>
      : unknown
    : Key extends keyof Type
    ? Type[Key] extends Map<string, infer MapType>
      ? MapType
      : PropertyType<Type[Key], Rest>
    : unknown
  : unknown;

export interface RootFilterOperators<TSchema> extends TDocument {
  $and?: Query<TSchema>[];
  $or?: Query<TSchema>[];
  $not?: Query<TSchema>;
}

export type Condition<T> = AlternativeType<T> | Query<AlternativeType<T>>;

export type AlternativeType<T> = T extends ReadonlyArray<infer U> ? T | RegExpOrString<U> : RegExpOrString<T>;

export type RegExpOrString<T> = T extends string ? RegExp | T : T;

export type EnhancedOmit<TRecordOrUnion, KeyUnion> = string extends keyof TRecordOrUnion
  ? TRecordOrUnion
  : TRecordOrUnion extends any
  ? Pick<TRecordOrUnion, Exclude<keyof TRecordOrUnion, KeyUnion>>
  : never;

export type WithId<TSchema> = EnhancedOmit<TSchema, '_id'> & {
  _id: string;
};

export interface RootFilterOperators<TSchema> extends TDocument {
  $and?: Query<TSchema>[];
  $or?: Query<TSchema>[];
  $not?: Query<TSchema>;
}

export declare type UpdateDefinition<TSchema> = {
  $inc?: OnlyFieldsOfType<TSchema, NumericType | undefined>;
  $min?: MatchKeysAndValues<TSchema>;
  $max?: MatchKeysAndValues<TSchema>;
  $set?: MatchKeysAndValues<TSchema>;
  $unset?: OnlyFieldsOfType<TSchema, any, '' | true | 1>;
  $addToSet?: SetFields<TSchema>;
  $pop?: OnlyFieldsOfType<TSchema, ReadonlyArray<any>, 1 | -1>;
  $pull?: PullOperator<TSchema>;
  $push?: PushOperator<TSchema>;
} & TDocument;

export type OnlyFieldsOfType<TSchema, FieldType = any, AssignableType = FieldType> = IfAny<
  TSchema[keyof TSchema],
  Record<string, FieldType>,
  AcceptedFields<TSchema, FieldType, AssignableType> &
    NotAcceptedFields<TSchema, FieldType> &
    Record<string, AssignableType>
>;

export type AcceptedFields<TSchema, FieldType, AssignableType> = {
  readonly [key in KeysOfAType<TSchema, FieldType>]?: AssignableType;
};

type KeysOfAType<TSchema, Type> = {
  [key in keyof TSchema]: NonNullable<TSchema[key]> extends Type ? key : never;
}[keyof TSchema];

export declare type NotAcceptedFields<TSchema, FieldType> = {
  readonly [key in KeysOfOtherType<TSchema, FieldType>]?: never;
};

export type IfAny<Type, ResultIfAny, ResultIfNotAny> = true extends false & Type ? ResultIfAny : ResultIfNotAny;

export type PullOperator<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, ReadonlyArray<any>>]?:
    | Partial<Flatten<TSchema[key]>>
    | FilterOperations<Flatten<TSchema[key]>>;
} & NotAcceptedFields<TSchema, ReadonlyArray<any>>) & {
  readonly [key: string]: Query<any> | any;
};

export type Flatten<Type> = Type extends ReadonlyArray<infer Item> ? Item : Type;

export type FilterOperations<T> = T extends Record<string, any>
  ? {
      [key in keyof T]?: Query<T[key]>;
    }
  : Query<T>;

export type MatchKeysAndValues<TSchema> = Readonly<
  {
    [Property in Join<NestedPaths<TSchema>, '.'>]?: PropertyType<TSchema, Property>;
  } & {
    [Property in `${NestedPathsOfType<TSchema, any[]>}.$${`[${string}]` | ''}`]?: ArrayElement<
      PropertyType<TSchema, Property extends `${infer Key}.$${string}` ? Key : never>
    >;
  } & {
    [Property in `${NestedPathsOfType<TSchema, Record<string, any>[]>}.$${`[${string}]` | ''}.${string}`]?: any;
  }
>;

export type ArrayElement<Type> = Type extends ReadonlyArray<infer Item> ? Item : never;

export type NestedPathsOfType<TSchema, Type> = KeysOfAType<
  {
    [Property in Join<NestedPaths<TSchema>, '.'>]: PropertyType<TSchema, Property>;
  },
  Type
>;

// export type PullAllOperator<TSchema> = ({
//   readonly [key in KeysOfAType<TSchema, ReadonlyArray<any>>]?: TSchema[key];
// } & NotAcceptedFields<TSchema, ReadonlyArray<any>>) & {
//   readonly [key: string]: ReadonlyArray<any>;
// };

export type PushOperator<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, ReadonlyArray<any>>]?:
    | Flatten<TSchema[key]>
    | ArrayOperator<Array<Flatten<TSchema[key]>>>;
} & NotAcceptedFields<TSchema, ReadonlyArray<any>>) & {
  readonly [key: string]: ArrayOperator<any> | any;
};

// @ts-ignore
export type ArrayOperator<Type> = {
  // $each?: Array<Flatten<Type>>;
  // $slice?: number;
  // $position?: number;
  // $sort?: Sort; // TODO
};

export type KeysOfOtherType<TSchema, Type> = {
  [key in keyof TSchema]: NonNullable<TSchema[key]> extends Type ? never : key;
}[keyof TSchema];

export type NumericType = number;

export type SetFields<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, ReadonlyArray<any> | undefined>]?:
    | OptionalId<Flatten<TSchema[key]>>
    | AddToSetOperators<Array<OptionalId<Flatten<TSchema[key]>>>>;
} & NotAcceptedFields<TSchema, ReadonlyArray<any> | undefined>) & {
  readonly [key: string]: AddToSetOperators<any> | any;
};

export type OptionalId<TSchema> = EnhancedOmit<TSchema, '_id'> & {
  _id?: InferIdType<TSchema>;
};

// @ts-ignore
export type InferIdType<TSchema> = string;

// @ts-ignore
export type AddToSetOperators<Type> = {
  // $each?: Array<Flatten<Type>>;
};

export type Sort =
  | string
  | Exclude<
      SortDirection,
      {
        $meta: string;
      }
    >
  | string[]
  | {
      [key: string]: SortDirection;
    }
  | [string, SortDirection][]
  | [string, SortDirection];

export type SortDirection = 1 | -1 | 'asc' | 'desc' | 'ascending' | 'descending';

```
## License

See [License](LICENSE)
