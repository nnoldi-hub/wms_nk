/**
 * Integration tests for /api/v1/products
 * Requires PostgreSQL to be reachable.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_2025';

const request = require('supertest');
const { app, pool } = require('../src/index');
const { getToken } = require('./helpers');

const adminToken = getToken('admin');
const operatorToken = getToken('operator');

const testSku = `TEST-SKU-${Date.now()}`;

beforeAll(async () => {
  await pool.query('SELECT 1');
});

afterAll(async () => {
  await pool.query('DELETE FROM products WHERE sku = $1', [testSku]);
});

// ─── GET /api/v1/products ─────────────────────────────────────────────────────

describe('GET /api/v1/products', () => {
  it('authenticated user can list products', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    // May return success:true or just an array depending on controller version
    expect([true, undefined]).toContain(res.body.success ?? true);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.statusCode).toBe(401);
  });
});

// ─── POST /api/v1/products ────────────────────────────────────────────────────

describe('POST /api/v1/products', () => {
  it('admin can create a product', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: testSku, name: 'Test Product', uom: 'm', lot_control: false });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('sku', testSku);
  });

  it('rejects creating duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: testSku, name: 'Duplicate', uom: 'm' });

    expect([400, 409]).toContain(res.statusCode);
  });

  it('operator is forbidden from creating products', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sku: `FORBIDDEN-${Date.now()}`, name: 'Should Fail', uom: 'm' });

    expect(res.statusCode).toBe(403);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No SKU' });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /api/v1/products/sku/:sku ───────────────────────────────────────────

describe('GET /api/v1/products/sku/:sku', () => {
  it('returns the created product', async () => {
    const res = await request(app)
      .get(`/api/v1/products/sku/${testSku}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('sku', testSku);
  });

  it('returns 404 for unknown SKU', async () => {
    const res = await request(app)
      .get('/api/v1/products/sku/NONEXISTENT-SKU-XYZ')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });
});

// ─── PUT /api/v1/products/sku/:sku ───────────────────────────────────────────

describe('PUT /api/v1/products/sku/:sku', () => {
  it('admin can update a product', async () => {
    const res = await request(app)
      .put(`/api/v1/products/sku/${testSku}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Test Product' });

    expect([200, 204]).toContain(res.statusCode);
  });
});

// ─── DELETE /api/v1/products/sku/:sku ────────────────────────────────────────

describe('DELETE /api/v1/products/sku/:sku', () => {
  it('admin can delete a product', async () => {
    const res = await request(app)
      .delete(`/api/v1/products/sku/${testSku}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect([200, 204]).toContain(res.statusCode);
  });
});
