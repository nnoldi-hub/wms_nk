const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { getToken } = require('./helpers');
const { v4: uuidv4 } = require('uuid');

describe('Warehouse Settings API', () => {
  const adminToken = getToken('admin');
  let warehouseId;
  let settingId;

  beforeAll(async () => {
    await db.query('SELECT 1');
    warehouseId = uuidv4();
    await db.query(`
      INSERT INTO warehouses (id, warehouse_code, warehouse_name, company_name, is_active)
      VALUES ($1, $2, $3, $4, true)
    `, [warehouseId, `WH-SET-${Date.now()}`, 'Settings Warehouse', 'Settings Co']);
  });

  afterAll(async () => {
    await db.query('UPDATE warehouses SET is_active = false WHERE id = $1', [warehouseId]);
  });

  it('POST /api/v1/warehouse-settings creates a setting', async () => {
    const res = await request(app)
      .post('/api/v1/warehouse-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse_id: warehouseId,
        setting_category: 'INVENTORY',
        setting_key: 'cycle_count_enabled',
        setting_value: true,
        setting_type: 'BOOLEAN',
        display_name: 'Enable Cycle Counting'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    settingId = res.body.data.id;
  });

  it('GET /api/v1/warehouses/:warehouseId/settings lists settings', async () => {
    const res = await request(app)
      .get(`/api/v1/warehouses/${warehouseId}/settings?category=INVENTORY`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
