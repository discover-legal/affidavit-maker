/** @jest-environment node */

const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
    on: jest.fn(),
  })),
}));

describe('database RLS query lifecycle', () => {
  let db;
  let client;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete global.__pgPoolPromise;
    delete global.__pgRequestALS;
    client = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: mockRelease,
    };
    mockConnect.mockResolvedValue(client);
    db = require('../../lib/db');
  });

  test('identity context does not acquire a client during non-database work', async () => {
    await db.withRLSContext(42, false, async () => {
      expect(mockConnect).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  test('a user query applies RLS in a short transaction and releases', async () => {
    client.query.mockImplementation(async (sql) =>
      sql === 'SELECT value FROM documents'
        ? { rows: [{ value: 'ok' }], rowCount: 1 }
        : { rows: [], rowCount: 0 },
    );

    const result = await db.withRLSContext(42, true, () =>
      db.query('SELECT value FROM documents'),
    );

    expect(result.rows).toEqual([{ value: 'ok' }]);
    expect(client.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SELECT set_config($1, $2, true)', ['app.user_id', '42']],
      ['SELECT set_config($1, $2, true)', ['app.current_user_id', '42']],
      ['SELECT set_config($1, $2, true)', ['app.is_admin', 'true']],
      ['SELECT value FROM documents', undefined],
      ['COMMIT'],
    ]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test('failed user queries roll back and release', async () => {
    const failure = new Error('query failed');
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BROKEN') throw failure;
      return { rows: [], rowCount: 0 };
    });

    await expect(db.withRLSContext(7, false, () => db.query('BROKEN'))).rejects.toBe(
      failure,
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test('bypass is atomic and outer user context resumes without deadlock', async () => {
    const userClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    };
    mockConnect.mockResolvedValueOnce(client).mockResolvedValueOnce(userClient);

    await db.withRLSContext(9, false, async () => {
      await db.withRLSBypass(async () => {
        await db.query('SYSTEM ONE');
        await db.query('SYSTEM TWO');
      });
      await db.query('USER QUERY');
    });

    expect(client.query).toHaveBeenCalledWith('SYSTEM ONE', undefined);
    expect(client.query).toHaveBeenCalledWith('SYSTEM TWO', undefined);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(userClient.query).toHaveBeenCalledWith(
      'SELECT set_config($1, $2, true)',
      ['app.user_id', '9'],
    );
    expect(userClient.query).toHaveBeenCalledWith('USER QUERY', undefined);
    expect(userClient.release).toHaveBeenCalledTimes(1);
  });
});
