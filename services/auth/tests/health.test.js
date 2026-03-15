process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_change_in_production';

const request = require('supertest');
const { app, redis } = require('../src/index');

beforeAll(async () => {
  // Connect Redis so health check can report status
  if (!redis.isOpen) {
    await redis.connect();
  }
});

describe('GET /health', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('redis', 'connected');
  });
});
