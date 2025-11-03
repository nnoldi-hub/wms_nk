const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { getToken } = require('./helpers');
const { v4: uuidv4 } = require('uuid');

describe('Delivery Zones API', () => {
  const token = getToken('admin');
  let warehouseId;
  let zoneId;
  let carrierId;

  beforeAll(async () => {
    await db.query('SELECT 1');
    warehouseId = uuidv4();
    await db.query(`
      INSERT INTO warehouses (id, warehouse_code, warehouse_name, company_name, is_active)
      VALUES ($1, $2, $3, $4, true)
    `, [warehouseId, `WH-DZ-${Date.now()}`, 'DZ Warehouse', 'DZ Co']);

    carrierId = uuidv4();
    await db.query(`
      INSERT INTO shipping_carriers (id, carrier_code, carrier_name, carrier_type, is_active)
      VALUES ($1, $2, $3, 'COURIER', true)
    `, [carrierId, `CR-${Date.now()}`, 'Test Carrier']);
  });

  afterAll(async () => {
    await db.query('UPDATE warehouses SET is_active = false WHERE id = $1', [warehouseId]);
    await db.query('UPDATE shipping_carriers SET is_active = false WHERE id = $1', [carrierId]);
  });

  it('POST /api/v1/delivery-zones creates a zone', async () => {
    const body = {
      warehouse_id: warehouseId,
      zone_code: `DZ-${Date.now()}`,
      zone_name: 'Bucuresti',
      zone_type: 'LOCAL',
      regions: ['Bucuresti']
    };

    const res = await request(app)
      .post('/api/v1/delivery-zones')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    zoneId = res.body.data.id;
  });

  it('POST /api/v1/delivery-zones/:zoneId/carriers upserts availability', async () => {
    const res = await request(app)
      .post(`/api/v1/delivery-zones/${zoneId}/carriers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ carrier_id: carrierId, priority: 1, estimated_delivery_days: 1, is_available: true });

    expect([200,201]).toContain(res.statusCode);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/delivery-zones/:zoneId/carriers lists carriers', async () => {
    const res = await request(app)
      .get(`/api/v1/delivery-zones/${zoneId}/carriers`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
