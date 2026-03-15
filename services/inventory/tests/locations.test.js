/**
 * Integration tests for /api/v1/locations
 * Requires PostgreSQL to be reachable.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_2025';

const request = require('supertest');
const { app, pool } = require('../src/index');
const { getToken } = require('./helpers');

const adminToken = getToken('admin');
const testLocationId = `TEST-LOC-${Date.now()}`;

beforeAll(async () => {
  await pool.query('SELECT 1');
});

afterAll(async () => {
  await pool.query('DELETE FROM locations WHERE id = $1', [testLocationId]);
});

describe('GET /api/v1/locations', () => {
  it('returns list of locations', async () => {
    const res = await request(app)
      .get('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/locations');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/locations', () => {
  it('admin can create a location', async () => {
    const res = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: testLocationId, zone: 'A', rack: '01', position: '01' });

    expect(res.statusCode).toBe(201);
  });

  it('validates required id field', async () => {
    const res = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zone: 'A' });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/locations/:id', () => {
  it('returns the created location', async () => {
    const res = await request(app)
      .get(`/api/v1/locations/${testLocationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
  });
});
