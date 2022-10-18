import { aggio, createDB, DB } from '../DB';

type UserWithAddress = {
  name: string;
  address?: { street: string; zip?: string; number?: number | null | undefined };
  addressList?: { street: string; zip?: string; number?: number | null | undefined }[];
};

describe('DB', () => {
  const Antonio = { name: 'Antonio' };
  const Rafaela = { name: 'Rafaela' };
  const users = [Antonio, Rafaela];

  const usersWithAddress: UserWithAddress[] = [
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
  ];

  const account = {
    username: 'antonio',
    firstName: 'antonio',
    lastName: 'Silva',
    access: [
      {
        kind: 'email',
        value: 'antonio@example.com',
        updatedAt: '2022-10-17T02:09:47.948Z',
        createdAt: '2022-10-17T02:09:47.948Z',
        verified: false,
      },
      {
        kind: 'phone',
        value: '+5511999988888',
        updatedAt: '2022-10-17T02:09:47.948Z',
        createdAt: '2022-10-17T02:09:47.948Z',
        verified: false,
      },
    ],
  };

  describe('aggio', () => {
    test('$groupBy accessKind', () => {
      const res = aggio(
        [account],
        [
          //
          { $pick: 'access' },
          { $groupBy: 'kind' },
        ]
      );
      expect(res).toEqual({
        email: [
          {
            createdAt: '2022-10-17T02:09:47.948Z',
            kind: 'email',
            updatedAt: '2022-10-17T02:09:47.948Z',
            value: 'antonio@example.com',
            verified: false,
          },
        ],
        phone: [
          {
            createdAt: '2022-10-17T02:09:47.948Z',
            kind: 'phone',
            updatedAt: '2022-10-17T02:09:47.948Z',
            value: '+5511999988888',
            verified: false,
          },
        ],
      });
    });

    test('$pick email', () => {
      const res = aggio(
        [account],
        [
          //
          { $pick: 'access' },
          { $matchOne: { kind: 'email' } },
          { $pick: 'value' },
        ]
      );
      expect(res).toEqual('antonio@example.com');
    });

    test('$keyBy accessKind', () => {
      const res = aggio(
        [account],
        [
          //
          { $pick: 'access' },
          { $keyBy: { $template: '{kind}#{value}' } },
        ]
      );

      expect(res).toEqual({
        'email#antonio@example.com': {
          createdAt: '2022-10-17T02:09:47.948Z',
          kind: 'email',
          updatedAt: '2022-10-17T02:09:47.948Z',
          value: 'antonio@example.com',
          verified: false,
        },
        'phone#+5511999988888': {
          createdAt: '2022-10-17T02:09:47.948Z',
          kind: 'phone',
          updatedAt: '2022-10-17T02:09:47.948Z',
          value: '+5511999988888',
          verified: false,
        },
      });
    });

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
          { $first: true },
          { $limit: 10 },
        ]
      );

      expect(sut).toEqual('Rafaela#av');
    });

    test('$keyBy: field.subField', () => {
      const sut = aggio<UserWithAddress>(usersWithAddress, [
        { $keyBy: 'address.street' },
        { $sort: { name: -1 } }, //
        { $matchOne: {} },
      ]);

      expect(sut).toEqual({
        Avenida: {
          address: {
            street: 'Avenida',
          },
          name: 'Rafaela',
        },
        Rua: {
          address: {
            street: 'Rua',
          },
          name: 'Antonio',
        },
      });
    });

    test('$groupBy: field.subField', () => {
      const sut = aggio<UserWithAddress>(usersWithAddress, [
        { $groupBy: 'address.street' },
        { $sort: { name: -1 } }, //
        { $matchOne: {} },
      ]);

      expect(sut).toEqual({
        Avenida: [
          {
            address: {
              street: 'Avenida',
            },
            name: 'Rafaela',
          },
        ],
        Rua: [
          {
            address: {
              street: 'Rua',
            },
            name: 'Antonio',
          },
        ],
      });
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
      const sut = aggio<UserWithAddress>(
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
          address: {
            street: 'Avenida',
          },
          name: 'Rafaela',
        },
        'antonio#rua': {
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
          address: {
            street: 'Rua',
          },
          name: 'Antonio',
        },
        'RAFAELA#avenida': {
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
            age: 55,
            name: 'Antonio',
          },
          {
            age: 20,
            name: 'Antonio',
          },
        ],
        Rafaela: [
          {
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
    let db: DB<UserWithAddress>;

    beforeEach(async () => (db = createDB()));

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

    // methods added in db but not in nedb
    describe('update (new methods)', () => {
      describe('$setIfNull', () => {
        //
        test('not set on not null', () => {
          db.insert(usersWithAddress);
          const sut = db.update({ name: /^ant/i }, { $setIfNull: { name: 'NewName' } });
          expect(sut).toHaveProperty('updated.name', 'Antonio');
        });

        test('set on null', () => {
          db.insert(usersWithAddress);

          const update1 = db.update({ name: /^ant/i }, { $set: { 'address.number': null } });
          expect(update1).toHaveProperty('updated.address.number', null);

          const sut = db.update({ name: /^ant/i }, { $setIfNull: { 'address.number': 2 } });
          expect(sut).toHaveProperty('updated.address.number', 2);
        });

        test('set on undefined', () => {
          db.insert(usersWithAddress);

          const update1 = db.update({ name: /^ant/i }, { $set: { 'address.number': undefined } });
          expect(update1).toHaveProperty('updated.address.number', undefined);

          const sut = db.update({ name: /^ant/i }, { $setIfNull: { 'address.number': 2 } });
          expect(sut).toHaveProperty('updated.address.number', 2);
        });

        test('set on array item', () => {
          db.insert(usersWithAddress);

          const update1 = db.update(
            { name: /^ant/i },
            {
              $addToSet: {
                addressList: {
                  street: 'fighter',
                },
              },
            }
          );

          expect(update1).toHaveProperty('updated.addressList', [{ street: 'fighter' }]);

          const sut = db.update(
            { name: /^ant/i, 'addressList.street': 'fighter' },
            { $setIfNull: { 'addressList.0.zip': '18120000' } }
          );

          expect(sut).toHaveProperty('updated.addressList.0.zip', '18120000');

          const update2 = db.update(
            { name: /^ant/i, 'addressList.street': 'fighter' },
            { $setIfNull: { 'addressList.0.zip': '5555555' } }
          );

          expect(update2).toHaveProperty('updated.addressList.0.zip', '18120000');
        });
      });

      describe('$prepend', () => {
        //
        test('not set on not null', () => {
          db.insert(usersWithAddress);

          db.update({ name: /^ant/i }, { $set: { addressList: [{ street: '3' }] } });
          db.update({ name: /^ant/i }, { $prepend: { addressList: { street: '2' } } });
          db.update({ name: /^ant/i }, { $push: { addressList: { street: '4' } } });

          const sut = db.update(
            { name: /^ant/i },
            {
              // unshift is an alias
              $unshift: {
                addressList: { street: '1' },
              },
            }
          );

          expect(sut.updated?.addressList).toEqual([
            {
              street: '1',
            },
            {
              street: '2',
            },
            {
              street: '3',
            },
            {
              street: '4',
            },
          ]);
        });

        test('set on null', () => {
          db.insert(usersWithAddress);

          db.update({ name: /^ant/i }, { $prepend: { addressList: { street: '3' } } });
          db.update({ name: /^ant/i }, { $prepend: { addressList: { street: '2' } } });
          db.update({ name: /^ant/i }, { $push: { addressList: { street: '4' } } });

          const sut = db.update(
            { name: /^ant/i },
            {
              // unshift is an alias
              $unshift: {
                addressList: { street: '1' },
              },
            }
          );

          expect(sut.updated?.addressList).toEqual([
            {
              street: '1',
            },
            {
              street: '2',
            },
            {
              street: '3',
            },
            {
              street: '4',
            },
          ]);
        });
      });
    });
  });
});
