// middleware/auth.js - RLS Helper Functions Only
// This file contains ONLY the Row Level Security helper functions
// All middleware logic has been consolidated into auth0Middleware.js

const logger = require('../utils/logger');

/**
 * Helper function to extract provider from auth0_id
 * @param {string} auth0Id - Auth0 identifier (format: "provider|id")
 * @returns {string} Provider name (e.g., "auth0", "google-oauth2", "facebook")
 */
function extractProvider(auth0Id) {
  if (!auth0Id) return 'unknown';
  const parts = auth0Id.split('|');
  return parts.length > 0 ? parts[0] : 'unknown';
}

/**
 * Helper function to log audit events to database
 * @param {object} client - Database client
 * @param {number} userId - User ID (can be null for system events)
 * @param {string} eventType - Type of event (e.g., "login", "logout")
 * @param {string} eventCategory - Category of event (e.g., "authentication")
 * @param {string} description - Human-readable description
 * @param {object} metadata - Additional metadata about the event
 * @param {string} severity - Severity level (info, warning, error)
 */
async function logAuditEvent(client, userId, eventType, eventCategory, description, metadata = {}, severity = 'info') {
  try {
    await client.query(
      `INSERT INTO audit_log (user_id, event_type, event_category, description, metadata, severity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, eventType, eventCategory, description, JSON.stringify(metadata), severity]
    );
  } catch (error) {
    logger.error('Failed to log audit event', { error: error.message, eventType });
  }
}

/**
 * Set Row Level Security (RLS) context for a database client
 * This configures session variables that RLS policies use to enforce data isolation
 *
 * @param {object} client - Database client
 * @param {number} userId - User ID (required)
 * @param {boolean} isAdmin - Whether user has admin privileges
 * @throws {Error} If context cannot be set
 */
async function setRLSContext(client, userId, isAdmin = false) {
  try {
    // Set session variables for Row Level Security
    // These variables are used by RLS policies to enforce data isolation
    // LOCAL scope ensures they only apply to current transaction/connection
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', userId.toString()]);
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', isAdmin.toString()]);

    logger.debug('RLS context set for user', { userId, isAdmin });
  } catch (error) {
    logger.error('Failed to set RLS context', {
      error: error.message,
      userId,
      isAdmin
    });
    throw new Error('Failed to set security context');
  }
}

/**
 * Set RLS bypass for system operations
 * Used for webhook processing and other server-side operations that need
 * to bypass user-level access restrictions
 *
 * @param {object} client - Database client
 * @throws {Error} If bypass cannot be set
 */
async function setRLSBypass(client) {
  try {
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);
    logger.debug('RLS bypass enabled for system operation');
  } catch (error) {
    logger.error('Failed to set RLS bypass', { error: error.message });
    throw new Error('Failed to set bypass context');
  }
}

module.exports = {
  extractProvider,
  logAuditEvent,
  setRLSContext,
  setRLSBypass
};
