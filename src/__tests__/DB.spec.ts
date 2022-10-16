import { aggio, createDB, DB } from '../DB';

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
