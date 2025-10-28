const { Pool } = require('pg');
const redis = require('redis');

// Product operations
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
        COUNT(*) OVER() as total_count,
        COALESCE(SUM(ii.quantity), 0) as total_quantity
      FROM products p
      LEFT JOIN inventory_items ii ON p.sku = ii.product_sku
    `;
    
    const params = [];
    
    if (search) {
      query += ` WHERE (p.sku ILIKE $1 OR p.name ILIKE $1 OR p.description ILIKE $1)`;
      params.push(`%${search}%`);
    }
    
    query += ` GROUP BY p.sku ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await req.db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
      }
    });
  } catch (error) {
    req.logger.error('Get products error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getProductBySku = async (req, res) => {
  try {
    const { sku } = req.params;

    const result = await req.db.query(`
      SELECT p.*, 
        COALESCE(SUM(ii.quantity), 0) as total_quantity,
        json_agg(
          json_build_object(
            'location_id', l.id,
            'zone', l.zone,
            'rack', l.rack,
            'position', l.position,
            'quantity', ii.quantity,
            'reserved_qty', ii.reserved_qty
          )
        ) FILTER (WHERE l.id IS NOT NULL) as locations
      FROM products p
      LEFT JOIN inventory_items ii ON p.sku = ii.product_sku
      LEFT JOIN locations l ON ii.location_id = l.id
      WHERE p.sku = $1
      GROUP BY p.sku, p.name, p.description, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, p.uom, p.lot_control, p.created_at, p.updated_at
    `, [sku]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    req.logger.error('Get product by SKU error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { sku, name, description, uom = 'm', lot_control = false, weight_kg, length_cm, width_cm, height_cm } = req.body;

    // Check if SKU already exists
    const existing = await req.db.query(
      'SELECT sku FROM products WHERE sku = $1',
      [sku]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
    }

    const result = await req.db.query(`
      INSERT INTO products (sku, name, description, uom, lot_control, weight_kg, length_cm, width_cm, height_cm)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [sku, name, description, uom, lot_control, weight_kg, length_cm, width_cm, height_cm]);

    // Audit log
    await req.db.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, ['product', result.rows[0].sku, 'CREATE', req.user.userId, JSON.stringify(result.rows[0])]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    req.logger.error('Create product error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { sku } = req.params;
    const { name, description, uom, lot_control, weight_kg, length_cm, width_cm, height_cm } = req.body;

    const result = await req.db.query(`
      UPDATE products
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          uom = COALESCE($3, uom),
          lot_control = COALESCE($4, lot_control),
          weight_kg = COALESCE($5, weight_kg),
          length_cm = COALESCE($6, length_cm),
          width_cm = COALESCE($7, width_cm),
          height_cm = COALESCE($8, height_cm),
          updated_at = NOW()
      WHERE sku = $9
      RETURNING *
    `, [name, description, uom, lot_control, weight_kg, length_cm, width_cm, height_cm, sku]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Audit log
    await req.db.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, ['product', result.rows[0].sku, 'UPDATE', req.user.userId, JSON.stringify(req.body)]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    req.logger.error('Update product error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
