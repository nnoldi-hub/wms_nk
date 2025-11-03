const request = require('supertest');
const app = require('../src/index');

describe('Health endpoint', () => {
  it('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'warehouse-config');
  });
});
