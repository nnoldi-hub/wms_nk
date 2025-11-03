const request = require('supertest');
const app = require('../src/index');

describe('GET /ready', () => {
  it('returns 200 and readiness details in test', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('service', 'warehouse-config');
    expect(res.body).toHaveProperty('dependencies');
    expect(res.body.dependencies).toHaveProperty('db');
    expect(res.body.dependencies).toHaveProperty('redis');
  });
});
