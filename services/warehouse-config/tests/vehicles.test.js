const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { getToken } = require('./helpers');
const { v4: uuidv4 } = require('uuid');

describe('Vehicles API', () => {
  const adminToken = getToken('admin');
  let warehouseId;
  let createdVehicle;

  beforeAll(async () => {
    // Ensure DB is reachable
    await db.query('SELECT 1');
    // Insert a test warehouse
    warehouseId = uuidv4();
    await db.query(`
      INSERT INTO warehouses (id, warehouse_code, warehouse_name, company_name, is_active)
      VALUES ($1, $2, $3, $4, true)
    `, [warehouseId, `WH-T-${Date.now()}`, 'Test Warehouse', 'Test Co']);
  });

  afterAll(async () => {
    // Soft-delete warehouse to avoid constraints
    await db.query('UPDATE warehouses SET is_active = false WHERE id = $1', [warehouseId]);
  });

  it('POST /api/v1/vehicles creates a vehicle', async () => {
    const body = {
      warehouse_id: warehouseId,
      vehicle_code: `V-${Date.now()}`,
      vehicle_type: 'VAN',
      license_plate: `B-${Math.floor(Math.random()*1000)}-TEST`,
      max_weight_kg: 1000
    };

    const res = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    createdVehicle = res.body.data;
  });

  it('GET /api/v1/vehicles/:id returns the vehicle', async () => {
    const res = await request(app)
      .get(`/api/v1/vehicles/${createdVehicle.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('vehicle_code', createdVehicle.vehicle_code);
  });
});
