const jwt = require('jsonwebtoken');

// Fixed UUIDs so we can insert/delete test users in DB
const TEST_ADMIN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TEST_OPERATOR_ID = 'aaaaaaaa-0000-0000-0000-000000000002';

// Inventory service default secret (matches middleware/auth.js fallback)
const JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_2025';

/**
 * Mint a signed JWT token compatible with the inventory service auth middleware.
 */
function getToken(role = 'admin', extra = {}) {
  const defaultId = role === 'admin' ? TEST_ADMIN_ID : TEST_OPERATOR_ID;
  const payload = {
    userId: extra.userId || defaultId,
    username: extra.username || `test_${role}`,
    role,
    ...extra,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Insert test users into the `users` table so audit_logs FK passes.
 * Cleans up by username first to handle leftovers from previous runs.
 */
async function setupTestUser(pool) {
  // Clean up any leftover audit_logs for our fixed UUIDs
  await pool.query(
    'DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[])',
    [[TEST_ADMIN_ID, TEST_OPERATOR_ID]]
  ).catch(() => {});
  // Remove existing test users by username (may have different UUIDs from old runs)
  await pool.query(
    "DELETE FROM users WHERE username IN ('test_admin', 'test_operator')"
  ).catch(() => {});
  // Insert fresh test users with fixed UUIDs
  await pool.query(`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES
      ($1, 'test_admin', 'test_admin@wms.local', 'x', 'admin'),
      ($2, 'test_operator', 'test_operator@wms.local', 'x', 'operator')
    ON CONFLICT DO NOTHING
  `, [TEST_ADMIN_ID, TEST_OPERATOR_ID]);
}

/**
 * Remove test users inserted by setupTestUser.
 */
async function cleanupTestUser(pool) {
  await pool.query(
    'DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[])',
    [[TEST_ADMIN_ID, TEST_OPERATOR_ID]]
  ).catch(() => {});
  await pool.query(
    "DELETE FROM users WHERE username IN ('test_admin', 'test_operator')"
  ).catch(() => {});
}

module.exports = { getToken, setupTestUser, cleanupTestUser };
