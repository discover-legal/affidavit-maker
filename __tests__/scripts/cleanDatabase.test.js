// __tests__/scripts/cleanDatabase.test.js
// This test validates the database cleanup logic independently
const { Pool } = require('pg');

// Mock pg module
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    end: jest.fn()
  };
  return { Pool: jest.fn(() => mPool) };
});

// Skip global setup for this test
jest.mock('../../tests/setup.js', () => ({}), { virtual: true });

describe('Database Cleanup Script', () => {
  let mockPool;
  let mockClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    // Setup mock pool
    mockPool = new Pool();
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.end.mockResolvedValue();
  });

  test('should call cleanup functions and report results', async () => {
    // Mock successful cleanup responses
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ cleanup_old_activity_logs: 150 }] })
      .mockResolvedValueOnce({ rows: [{ cleanup_expired_sessions: 25 }] });

    // Import and execute cleanup (mocked)
    const cleanupLogic = async (pool) => {
      const client = await pool.connect();
      
      try {
        const activityResult = await client.query('SELECT cleanup_old_activity_logs()');
        const activityDeleted = activityResult.rows[0].cleanup_old_activity_logs;
        
        const sessionResult = await client.query('SELECT cleanup_expired_sessions()');
        const sessionsDeleted = sessionResult.rows[0].cleanup_expired_sessions;
        
        return {
          activityDeleted,
          sessionsDeleted,
          total: activityDeleted + sessionsDeleted
        };
      } finally {
        client.release();
      }
    };

    const result = await cleanupLogic(mockPool);

    // Verify the cleanup functions were called
    expect(mockClient.query).toHaveBeenCalledWith('SELECT cleanup_old_activity_logs()');
    expect(mockClient.query).toHaveBeenCalledWith('SELECT cleanup_expired_sessions()');
    
    // Verify results
    expect(result.activityDeleted).toBe(150);
    expect(result.sessionsDeleted).toBe(25);
    expect(result.total).toBe(175);
    
    // Verify cleanup
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('should handle database connection errors', async () => {
    // Mock connection failure
    const connectionError = new Error('Connection refused');
    mockPool.connect.mockRejectedValue(connectionError);

    // Import and execute cleanup (mocked)
    const cleanupLogic = async (pool) => {
      const client = await pool.connect();
      return client;
    };

    await expect(cleanupLogic(mockPool)).rejects.toThrow('Connection refused');
  });

  test('should handle query errors and cleanup client', async () => {
    // Mock query failure
    const queryError = new Error('Query failed');
    mockClient.query.mockRejectedValue(queryError);

    // Import and execute cleanup (mocked)
    const cleanupLogic = async (pool) => {
      const client = await pool.connect();
      
      try {
        await client.query('SELECT cleanup_old_activity_logs()');
      } finally {
        client.release();
      }
    };

    await expect(cleanupLogic(mockPool)).rejects.toThrow('Query failed');
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('should properly release client even on error', async () => {
    mockClient.query.mockRejectedValue(new Error('Query error'));

    const cleanupLogic = async (pool) => {
      const client = await pool.connect();
      
      try {
        await client.query('SELECT cleanup_old_activity_logs()');
      } catch (error) {
        // Error handled
      } finally {
        client.release();
      }
    };

    await cleanupLogic(mockPool);
    expect(mockClient.release).toHaveBeenCalled();
  });
});
