const request = require('supertest');
const app = require('../src/index');

describe('GET /metrics', () => {
  it('returns Prometheus metrics in text format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    // basic sanity: default process metric exists
    expect(res.text).toMatch(/process_cpu_user_seconds_total|nodejs_eventloop_lag_seconds/);
  });
});
