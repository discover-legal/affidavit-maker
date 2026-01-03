/**
 * Security Tests for Auth Middleware
 * Tests the fix for the critical account takeover vulnerability
 *
 * These tests verify:
 * 1. Duplicate email signups are blocked
 * 2. Audit logging works correctly
 * 3. Existing users still work
 * 4. Multi-provider support works
 */

const { Pool } = require('pg');

// Mock dependencies
jest.mock('../../utils/logger');

describe('Auth Middleware Security Tests', () => {
  let pool;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeAll(async () => {
    // Setup test database connection
    // In a real test, you'd use a test database
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(() => {
    // Setup mock request, response, and next function
    mockReq = {
      auth: null,
      userId: null,
      user: null,
      headers: {},
      path: '/test',
      id: 'test-request-id',
      app: {
        locals: {
          pool: pool
        }
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('Duplicate Email Protection (CVE-2026-001)', () => {
    test('should block signup with existing email using different provider', async () => {
      // This test verifies the security fix
      //
      // Setup: User exists with email/password (auth0|123)
      // Attack: Try to signup with same email via Google (google-oauth2|456)
      // Expected: Signup is blocked with 409 error

      const existingEmail = `test-${Date.now()}@example.com`;

      // Create initial user via email/password
      const initialAuth0Id = `auth0|test-${Date.now()}`;
      await pool.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [initialAuth0Id, existingEmail, 'Test User']
      );

      // Simulate attacker trying to signup with same email via Google
      mockReq.auth = {
        sub: `google-oauth2|attacker-${Date.now()}`,
        email: existingEmail,
        name: 'Attacker'
      };

      // Import and run middleware
      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // Verify: Should receive 409 Conflict error
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorType: 'account_exists',
          errorCode: 'DUPLICATE_EMAIL'
        })
      );

      // Verify: Original user's auth0_id should NOT be changed
      const result = await pool.query(
        'SELECT auth0_id FROM users WHERE email = $1',
        [existingEmail]
      );
      expect(result.rows[0].auth0_id).toBe(initialAuth0Id);

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [existingEmail]);
    });

    test('should log audit event when duplicate email signup is blocked', async () => {
      const existingEmail = `test-audit-${Date.now()}@example.com`;

      // Create initial user
      const initialAuth0Id = `auth0|test-${Date.now()}`;
      await pool.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [initialAuth0Id, existingEmail, 'Test User']
      );

      // Get current audit log count
      const beforeCount = await pool.query(
        'SELECT COUNT(*) FROM audit_log WHERE event_type = $1',
        ['duplicate_email_signup_blocked']
      );

      // Attempt duplicate signup
      mockReq.auth = {
        sub: `google-oauth2|attacker-${Date.now()}`,
        email: existingEmail,
        name: 'Attacker'
      };

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // Verify: Audit log entry was created
      const afterCount = await pool.query(
        'SELECT COUNT(*) FROM audit_log WHERE event_type = $1',
        ['duplicate_email_signup_blocked']
      );
      expect(parseInt(afterCount.rows[0].count)).toBeGreaterThan(
        parseInt(beforeCount.rows[0].count)
      );

      // Verify: Audit log contains correct metadata
      const auditEntry = await pool.query(
        `SELECT * FROM audit_log
         WHERE event_type = 'duplicate_email_signup_blocked'
         AND metadata->>'email' = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [existingEmail]
      );
      expect(auditEntry.rows.length).toBe(1);
      expect(auditEntry.rows[0].severity).toBe('warning');

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [existingEmail]);
    });
  });

  describe('Multi-Provider Support', () => {
    test('should load user from user_identities table', async () => {
      const testEmail = `test-multi-${Date.now()}@example.com`;
      const auth0Id = `google-oauth2|test-${Date.now()}`;

      // Create user with identity
      const userResult = await pool.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [auth0Id, testEmail, 'Test User']
      );
      const userId = userResult.rows[0].id;

      await pool.query(
        `INSERT INTO user_identities (user_id, auth0_id, provider, is_primary, verified)
         VALUES ($1, $2, $3, true, true)`,
        [userId, auth0Id, 'google-oauth2']
      );

      // Simulate login
      mockReq.auth = {
        sub: auth0Id,
        email: testEmail,
        name: 'Test User'
      };

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // Verify: User loaded successfully
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.email).toBe(testEmail);

      // Cleanup
      await pool.query('DELETE FROM user_identities WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    test('should fallback to legacy users.auth0_id for backwards compatibility', async () => {
      const testEmail = `test-legacy-${Date.now()}@example.com`;
      const auth0Id = `auth0|legacy-${Date.now()}`;

      // Create user WITHOUT user_identities entry (legacy)
      await pool.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [auth0Id, testEmail, 'Legacy User']
      );

      // Simulate login
      mockReq.auth = {
        sub: auth0Id,
        email: testEmail,
        name: 'Legacy User'
      };

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // Verify: User loaded successfully via legacy path
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.email).toBe(testEmail);

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
    });
  });

  describe('New User Creation', () => {
    test('should create user with user_identity record', async () => {
      const testEmail = `test-new-${Date.now()}@example.com`;
      const auth0Id = `auth0|new-${Date.now()}`;

      mockReq.auth = {
        sub: auth0Id,
        email: testEmail,
        name: 'New User'
      };

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // Verify: User was created
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();

      // Verify: user_identity record exists
      const identityResult = await pool.query(
        'SELECT * FROM user_identities WHERE auth0_id = $1',
        [auth0Id]
      );
      expect(identityResult.rows.length).toBe(1);
      expect(identityResult.rows[0].provider).toBe('auth0');
      expect(identityResult.rows[0].is_primary).toBe(true);

      // Verify: Audit log entry exists
      const auditResult = await pool.query(
        `SELECT * FROM audit_log
         WHERE event_type = 'account_created'
         AND user_id = $1`,
        [mockReq.user.id]
      );
      expect(auditResult.rows.length).toBeGreaterThan(0);

      // Cleanup
      const userId = mockReq.user.id;
      await pool.query('DELETE FROM user_identities WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    test('should extract provider correctly from auth0_id', async () => {
      const providers = [
        { auth0Id: 'google-oauth2|123', expected: 'google-oauth2' },
        { auth0Id: 'auth0|456', expected: 'auth0' },
        { auth0Id: 'facebook|789', expected: 'facebook' },
        { auth0Id: 'github|abc', expected: 'github' }
      ];

      for (const { auth0Id, expected } of providers) {
        const testEmail = `test-provider-${Date.now()}-${expected}@example.com`;

        mockReq.auth = {
          sub: auth0Id,
          email: testEmail,
          name: 'Test User'
        };

        const { loadUser } = require('../../middleware/auth0Middleware');
        await loadUser(mockReq, mockRes, mockNext);

        // Verify provider was extracted correctly
        const identityResult = await pool.query(
          'SELECT provider FROM user_identities WHERE auth0_id = $1',
          [auth0Id]
        );
        expect(identityResult.rows[0].provider).toBe(expected);

        // Cleanup
        const userId = mockReq.user.id;
        await pool.query('DELETE FROM user_identities WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      }
    });
  });

  describe('Audit Logging', () => {
    test('should log all security events', async () => {
      const testEmail = `test-audit-full-${Date.now()}@example.com`;
      const auth0Id = `auth0|audit-${Date.now()}`;

      // Create new user (should log 'account_created')
      mockReq.auth = {
        sub: auth0Id,
        email: testEmail,
        name: 'Audit Test'
      };

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      const userId = mockReq.user.id;

      // Verify audit log entry
      const auditResult = await pool.query(
        `SELECT event_type, event_category, severity, metadata
         FROM audit_log
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      expect(auditResult.rows.length).toBeGreaterThan(0);

      const accountCreatedLog = auditResult.rows.find(
        row => row.event_type === 'account_created'
      );
      expect(accountCreatedLog).toBeDefined();
      expect(accountCreatedLog.event_category).toBe('authentication');
      expect(accountCreatedLog.severity).toBe('info');

      const metadata = accountCreatedLog.metadata;
      expect(metadata.auth0_id).toBe(auth0Id);
      expect(metadata.email).toBe(testEmail);

      // Cleanup
      await pool.query('DELETE FROM user_identities WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Simulate invalid database pool
      mockReq.app.locals.pool = null;

      mockReq.auth = {
        sub: 'auth0|test',
        email: 'test@example.com',
        name: 'Test'
      };

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // Verify error response
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorType: 'server_error'
        })
      );
    });
  });
});

describe('Integration Tests', () => {
  test('SECURITY: Verify complete attack scenario is blocked', async () => {
    /**
     * This test simulates the complete attack scenario described in
     * SECURITY_ANALYSIS_CRITICAL.md and verifies it's blocked
     */

    const victimEmail = `victim-${Date.now()}@example.com`;
    const victimAuth0Id = `auth0|victim-${Date.now()}`;
    const attackerAuth0Id = `google-oauth2|attacker-${Date.now()}`;

    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    });

    try {
      // Step 1: Victim creates account
      await pool.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [victimAuth0Id, victimEmail, 'Victim']
      );

      // Step 2: Victim creates affidavit
      const docResult = await pool.query(
        `INSERT INTO documents (user_id, title, content, created_at)
         SELECT id, 'Sensitive Document', '{"secret": true}', NOW()
         FROM users WHERE email = $1
         RETURNING id`,
        [victimEmail]
      );
      const documentId = docResult.rows[0].id;

      // Step 3: Attacker tries to signup with same email
      const mockReq = {
        auth: {
          sub: attackerAuth0Id,
          email: victimEmail,
          name: 'Attacker'
        },
        headers: {},
        path: '/test',
        id: 'attack-test',
        app: { locals: { pool } }
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };

      const mockNext = jest.fn();

      const { loadUser } = require('../../middleware/auth0Middleware');
      await loadUser(mockReq, mockRes, mockNext);

      // VERIFY ATTACK IS BLOCKED:

      // 1. Attacker receives 409 error
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'DUPLICATE_EMAIL'
        })
      );

      // 2. Victim's auth0_id is UNCHANGED
      const victimCheck = await pool.query(
        'SELECT auth0_id FROM users WHERE email = $1',
        [victimEmail]
      );
      expect(victimCheck.rows[0].auth0_id).toBe(victimAuth0Id);

      // 3. Attacker does NOT have access to victim's documents
      // (because they were rejected and never got a user ID)
      expect(mockReq.user).toBeUndefined();

      // 4. Security event was logged
      const auditCheck = await pool.query(
        `SELECT * FROM audit_log
         WHERE event_type = 'duplicate_email_signup_blocked'
         AND metadata->>'email' = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [victimEmail]
      );
      expect(auditCheck.rows.length).toBe(1);
      expect(auditCheck.rows[0].metadata.auth0_id).toBe(attackerAuth0Id);

      console.log('✅ SECURITY TEST PASSED: Attack scenario successfully blocked');

    } finally {
      // Cleanup
      await pool.query('DELETE FROM documents WHERE id IN (SELECT id FROM documents d JOIN users u ON d.user_id = u.id WHERE u.email = $1)', [victimEmail]);
      await pool.query('DELETE FROM users WHERE email = $1', [victimEmail]);
      await pool.end();
    }
  });
});
