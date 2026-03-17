/**
 * Integration tests for /api/v1/users (admin CRUD)
 * Requires PostgreSQL and Redis to be reachable.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_change_in_production';

const request = require('supertest');
const { app, db, redis } = require('../src/index');
const { getToken } = require('./helpers');

let adminToken;
let createdUserId;
const testUsername = `user_crud_${Date.now()}`;

beforeAll(async () => {
  if (!redis.isOpen) await redis.connect();
  await db.query('SELECT 1');

  // Create a real admin user in DB so the JWT userId resolves to a valid row
  // (needed for audit_logs FK). Use a well-known UUID for test admin.
  const adminId = '00000000-0000-0000-0000-000000000001';
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('AdminPass!123', 10);
  await db.query(`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES ($1, $2, $3, $4, 'admin')
    ON CONFLICT DO NOTHING
  `, [adminId, 'test_admin_fixture', 'test_admin@wms.test', hash]);

  adminToken = getToken('admin', { userId: adminId, username: 'test_admin_fixture' });
});

afterAll(async () => {
  // Delete audit_logs first to avoid FK constraint when deleting users
  const adminId = '00000000-0000-0000-0000-000000000001';
  await db.query('DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[])',
    [[adminId, createdUserId].filter(Boolean)]).catch(() => {});
  if (createdUserId) {
    await db.query('DELETE FROM users WHERE id = $1', [createdUserId]);
  }
  await db.query("DELETE FROM users WHERE username IN ('test_admin_fixture', $1)", [testUsername]);
});

// ─── GET all users ────────────────────────────────────────────────────────────

describe('GET /api/v1/users', () => {
  it('admin can list all users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('operator role is forbidden from listing users', async () => {
    const opToken = getToken('operator');
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${opToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.statusCode).toBe(401);
  });
});

// ─── POST create user ─────────────────────────────────────────────────────────

describe('POST /api/v1/users', () => {
  it('admin can create a new user', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: testUsername,
        email: `${testUsername}@wms.test`,
        password: 'Pass!1234',
        role: 'operator',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    createdUserId = res.body.data.id;
  });

  it('rejects duplicate username', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: testUsername,
        email: `other_${testUsername}@wms.test`,
        password: 'Pass!1234',
      });

    expect(res.statusCode).toBe(409);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'incomplete' });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET user by ID ───────────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  it('admin can fetch any user by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('username', testUsername);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .get('/api/v1/users/00000000-0000-0000-0000-999999999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });
});

// ─── PUT update user ──────────────────────────────────────────────────────────

describe('PUT /api/v1/users/:id', () => {
  it('admin can update a user', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'supervisor' });

    expect([200, 204]).toContain(res.statusCode);
  });
});

// ─── DELETE user ──────────────────────────────────────────────────────────────

describe('DELETE /api/v1/users/:id', () => {
  it('admin can delete a user', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect([200, 204]).toContain(res.statusCode);
    createdUserId = null; // already deleted, skip afterAll cleanup
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .delete('/api/v1/users/00000000-0000-0000-0000-999999999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });
});
