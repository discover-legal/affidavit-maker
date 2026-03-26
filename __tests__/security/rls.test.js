// __tests__/security/rls.test.js
// Row Level Security (RLS) Tests
//
// CRITICAL: These tests verify that RLS policies correctly enforce data isolation
// If these tests fail, users may be able to access each other's data!

const { Pool } = require('pg');

describe('Row Level Security (RLS)', () => {
  let pool;
  let testUser1Id;
  let testUser2Id;
  let testDocument1Id;
  let testDocument2Id;

  beforeAll(async () => {
    // Connect to test database
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    });

    // Create test users with bypass RLS enabled for setup
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

      // Create test user 1
      const user1 = await client.query(
        'INSERT INTO users (auth0_id, email, name) VALUES ($1, $2, $3) RETURNING id',
        ['rls_test_1|user1', 'rls_test_user1@test.com', 'RLS Test User 1']
      );
      testUser1Id = user1.rows[0].id;

      // Create test user 2
      const user2 = await client.query(
        'INSERT INTO users (auth0_id, email, name) VALUES ($1, $2, $3) RETURNING id',
        ['rls_test_2|user2', 'rls_test_user2@test.com', 'RLS Test User 2']
      );
      testUser2Id = user2.rows[0].id;

      // Create document for user 1
      const doc1 = await client.query(
        'INSERT INTO documents (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
        [testUser1Id, 'User 1 Document', '{"facts": []}']
      );
      testDocument1Id = doc1.rows[0].id;

      // Create document for user 2
      const doc2 = await client.query(
        'INSERT INTO documents (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
        [testUser2Id, 'User 2 Document', '{"facts": []}']
      );
      testDocument2Id = doc2.rows[0].id;

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Clean up test data with bypass RLS
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

      await client.query('DELETE FROM documents WHERE user_id IN ($1, $2)', [testUser1Id, testUser2Id]);
      await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser1Id, testUser2Id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    await pool.end();
  });

  describe('Document Isolation', () => {
    test('User 1 can access their own documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query(
          'SELECT * FROM documents WHERE id = $1',
          [testDocument1Id]
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].user_id).toBe(testUser1Id);
        expect(result.rows[0].title).toBe('User 1 Document');

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User 1 CANNOT access User 2 documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query(
          'SELECT * FROM documents WHERE id = $1',
          [testDocument2Id]
        );

        // RLS should prevent access - should return 0 rows
        expect(result.rows.length).toBe(0);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User 2 can access their own documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser2Id.toString()]);

        const result = await client.query(
          'SELECT * FROM documents WHERE id = $1',
          [testDocument2Id]
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].user_id).toBe(testUser2Id);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User 2 CANNOT access User 1 documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser2Id.toString()]);

        const result = await client.query(
          'SELECT * FROM documents WHERE id = $1',
          [testDocument1Id]
        );

        // RLS should prevent access
        expect(result.rows.length).toBe(0);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User cannot see other users documents in list query', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query('SELECT * FROM documents');

        // Should only see own documents
        expect(result.rows.length).toBeGreaterThan(0);
        result.rows.forEach(doc => {
          expect(doc.user_id).toBe(testUser1Id);
        });

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('User Isolation', () => {
    test('User can access their own profile', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query('SELECT * FROM users WHERE id = $1', [testUser1Id]);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(testUser1Id);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User CANNOT access other user profiles', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query('SELECT * FROM users WHERE id = $1', [testUser2Id]);

        // RLS should prevent access
        expect(result.rows.length).toBe(0);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('RLS Bypass for System Operations', () => {
    test('Bypass flag allows access to all documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

        const result = await client.query('SELECT COUNT(*) as count FROM documents');

        // Should see all documents
        const count = parseInt(result.rows[0].count);
        expect(count).toBeGreaterThanOrEqual(2); // At least our 2 test documents

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('Bypass flag allows access to all users', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

        const result = await client.query('SELECT COUNT(*) as count FROM users');

        const count = parseInt(result.rows[0].count);
        expect(count).toBeGreaterThanOrEqual(2);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('Admin Access', () => {
    test('Admin flag allows access to all user data', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', 'true']);

        // Should be able to access other users' documents
        const result = await client.query('SELECT * FROM documents WHERE id = $1', [testDocument2Id]);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].user_id).toBe(testUser2Id);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('RLS Policy Functions', () => {
    test('current_user_id() function works', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query('SELECT current_user_id() as user_id');

        expect(result.rows[0].user_id).toBe(testUser1Id);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('current_user_is_admin() function works', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', 'true']);

        const result = await client.query('SELECT current_user_id() as user_id, current_user_is_admin() as is_admin');

        expect(result.rows[0].is_admin).toBe(true);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('bypass_rls_enabled() function works', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

        const result = await client.query('SELECT bypass_rls_enabled() as bypass_enabled');

        expect(result.rows[0].bypass_enabled).toBe(true);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('INSERT/UPDATE/DELETE with RLS', () => {
    test('User can insert their own documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query(
          'INSERT INTO documents (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
          [testUser1Id, 'Test Insert', '{"facts": []}']
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBeDefined();

        // Clean up
        const insertedId = result.rows[0].id;
        await client.query('DELETE FROM documents WHERE id = $1', [insertedId]);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User can update their own documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query(
          'UPDATE documents SET title = $1 WHERE id = $2 RETURNING id',
          ['Updated Title', testDocument1Id]
        );

        expect(result.rows.length).toBe(1);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User CANNOT update other users documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query(
          'UPDATE documents SET title = $1 WHERE id = $2 RETURNING id',
          ['Malicious Update', testDocument2Id]
        );

        // RLS should prevent update
        expect(result.rows.length).toBe(0);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User can delete their own documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        // Create a document to delete
        const createResult = await client.query(
          'INSERT INTO documents (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
          [testUser1Id, 'To Delete', '{"facts": []}']
        );
        const docId = createResult.rows[0].id;

        // Delete it
        const deleteResult = await client.query(
          'DELETE FROM documents WHERE id = $1 RETURNING id',
          [docId]
        );

        expect(deleteResult.rows.length).toBe(1);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('User CANNOT delete other users documents', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_user');
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUser1Id.toString()]);

        const result = await client.query(
          'DELETE FROM documents WHERE id = $1 RETURNING id',
          [testDocument2Id]
        );

        // RLS should prevent delete
        expect(result.rows.length).toBe(0);

        await client.query('RESET ROLE');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('RLS Status Verification', () => {
    test('RLS is enabled on all critical tables', async () => {
      const result = await pool.query(`
        SELECT schemaname, tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'documents', 'payments', 'sessions', 'user_identities', 'audit_log')
      `);

      result.rows.forEach(table => {
        expect(table.rowsecurity).toBe(true);
      });
    });

    test('RLS policies exist for all critical tables', async () => {
      const result = await pool.query(`
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'documents', 'payments')
        GROUP BY tablename
      `);

      result.rows.forEach(table => {
        expect(parseInt(table.policy_count)).toBeGreaterThan(0);
      });
    });
  });
});
