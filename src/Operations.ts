import { stringCase, TemplateOptions, tupleEnum } from './util';

export const objectModifies = tupleEnum(
  '$set',
  '$unset',
  '$push',
  '$addToSet',
  '$addToSet',
  '$pop',
  '$pull',
  '$inc',
  '$max',
  '$min'
);

export const comparisonOperatorsEnum = tupleEnum(
  '$lt',
  '$lte',
  '$gt',
  '$eq',
  '$gte',
  '$ne',
  '$in',
  '$nin',
  '$in',
  '$regex',
  '$exists',
  '$size',
  '$elemMatch',
  '$regex'
);

export type ComparisonOperator = typeof comparisonOperatorsEnum.enum;

export const objectLogicalOperators = tupleEnum('$or', '$and', '$not');

export const objectArrayComparisons = tupleEnum('$size', '$elemMatch');

export const aggregationOperatorKeys = tupleEnum(
  '$update',
  '$matchOne',
  '$limit',
  '$sort',
  '$match',
  '$project',
  '$groupBy',
  '$keyBy',
  '$pick'
);

export type AggregationOperatorKeys = typeof aggregationOperatorKeys.enum;

export type Aggregation<TSchema> = AggregationOperator<TSchema>[];

export type AggregationOperatorKey = AggregationOperator<any> extends infer R
  ? R extends unknown
    ? keyof R
    : never
  : never;

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
  | { $first: true }
  | { $last: true }
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

export type GroupByDefinition<TSchema> =
  | {
      [Property in Join<NestedPaths<WithId<TSchema>>, '.'> as PropertyType<TSchema, Property> extends number | string
        ? Property
        : never]?: PropertyType<WithId<TSchema>, Property> | Condition<PropertyType<WithId<TSchema>, Property>>;
    }
  | Join<NestedPaths<WithId<TSchema>>, '.'>;

export type KeyByDefinition<TSchema extends any = { _id?: string }> =
  | ((
      | {
          [Property in Join<NestedPaths<WithId<TSchema>>, '.'> as PropertyType<TSchema, Property> extends
            | number
            | string
            ? Property
            : never]?: PropertyType<WithId<TSchema>, Property> | Condition<PropertyType<WithId<TSchema>, Property>>;
        }
      | PickDefinition<TSchema>
      | TemplateDefinition
    ) & {
      $onMany?: 'first' | 'last' | 'error' | 'warn' | 'list';
    })
  | Join<NestedPaths<WithId<TSchema>>, '.'>;

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
