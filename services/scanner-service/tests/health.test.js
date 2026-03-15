/**
 * Health check test for scanner-service.
 * NOTE: In test mode (NODE_ENV=test) the service does NOT connect to Redis or
 * RabbitMQ, so the health endpoint returns "disconnected" for those services.
 * The test verifies only that the HTTP layer is alive.
 */
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('responds with 200 and service name', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'scanner-service');
  });
});

describe('Unknown route', () => {
  it('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.statusCode).toBe(404);
  });
});
