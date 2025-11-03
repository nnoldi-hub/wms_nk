const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { getToken } = require('./helpers');
const { v4: uuidv4 } = require('uuid');

describe('Workflow API', () => {
  const adminToken = getToken('admin');
  const someWarehouseId = uuidv4();
  let stateId;

  beforeAll(async () => {
    await db.query('SELECT 1');
  });

  it('POST /api/v1/workflow/states creates a state', async () => {
    const res = await request(app)
      .post('/api/v1/workflow/states')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ state_code: `TEST_${Date.now()}`, state_name: 'Test State', state_category: 'QC', is_initial_state: false, is_final_state: false });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    stateId = res.body.data.id;
  });

  it('GET /api/v1/warehouses/:warehouseId/workflow/states lists states', async () => {
    const res = await request(app)
      .get(`/api/v1/warehouses/${someWarehouseId}/workflow/states`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
