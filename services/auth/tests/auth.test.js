/**
 * Integration tests for /api/v1/auth (login, register, refresh, logout, /me)
 * Requires PostgreSQL and Redis to be reachable (see docker-compose.yml or .env).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_change_in_production';

const request = require('supertest');
const { app, db, redis } = require('../src/index');

const TEST_USER = {
  username: `test_user_${Date.now()}`,
  email: `test_${Date.now()}@wms.test`,
  password: 'TestPass!123',
};

let accessToken;
let refreshToken;

beforeAll(async () => {
  if (!redis.isOpen) await redis.connect();
  await db.query('SELECT 1');
});

afterAll(async () => {
  // Remove test user created during register test
  await db.query('DELETE FROM users WHERE username = $1', [TEST_USER.username]);
});

// ─── Register ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('creates a new user with default operator role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(TEST_USER);

    expect(res.statusCode).toBe(201);
    expect(res.body.user).toMatchObject({
      username: TEST_USER.username,
      email: TEST_USER.email,
      role: 'operator',
    });
  });

  it('rejects duplicate username', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(TEST_USER);

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'noemail' });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('logs in successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toMatchObject({ username: TEST_USER.username });

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USER.username, password: 'wrong_password' });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('rejects unknown username', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ghost_user_xyz', password: 'any' });

    expect(res.statusCode).toBe(401);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.statusCode).toBe(400);
  });
});

// ─── /me ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toMatchObject({ username: TEST_USER.username });
  });

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.statusCode).toBe(401);
  });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('issues new tokens using a valid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    // Update tokens for subsequent tests
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects an already-used refresh token', async () => {
    // The token captured before this test was consumed above
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'consumed_refresh_token' });

    expect(res.statusCode).toBe(401);
  });

  it('rejects missing refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(res.statusCode).toBe(400);
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('logs out successfully and invalidates refresh tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out successfully');
  });

  it('rejects logout without token', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.statusCode).toBe(401);
  });
});
