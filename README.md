# Aggio

> Aggregation utility for objects like in MongoDB

## Installation

```
npm install aggio --save    # Put latest version in your package.json
```

```ts
import { aggio, createDB, DB } from 'aggio';

describe('aggio', () => {
  const Antonio = { name: 'Antonio' };
  const Rafaela = { name: 'Rafaela' };
  const users = [Antonio, Rafaela];

  test('$matchOne', () => {
    const sut = aggio(users, [{ $matchOne: { name: /ant/i } }]);
    expect(sut).toMatchObject(Antonio);
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
});

describe('DB', () => {
  let db: DB<{ name: string }>;

  beforeEach(async () => {
    db = createDB();
  });

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
```

## License

See [License](LICENSE)

```

```
