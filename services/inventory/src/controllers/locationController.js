// Location operations
exports.getAllLocations = async (req, res) => {
  try {
    const { zone, is_active = 'true' } = req.query;

    let query = `
      SELECT l.*,
        COUNT(ii.id) as item_count,
        COALESCE(SUM(ii.quantity), 0) as total_quantity
      FROM locations l
      LEFT JOIN inventory_items ii ON l.id = ii.location_id
    `;
    
    const params = [];
    const conditions = [];
    
    // Filter by active status
    if (is_active !== 'all') {
      conditions.push(`l.is_active = $${params.length + 1}`);
      params.push(is_active === 'true');
    }
    
    // Filter by zone
    if (zone) {
      conditions.push(`l.zone = $${params.length + 1}`);
      params.push(zone);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY l.id, l.zone, l.rack, l.position, l.allowed_types, l.capacity_m3, l.is_active, l.created_at, l.updated_at ORDER BY l.zone, l.rack, l.position`;

    const result = await req.db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    req.logger.error('Get locations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await req.db.query(`
      SELECT l.*,
        json_agg(
          json_build_object(
            'product_sku', p.sku,
            'name', p.name,
            'quantity', ii.quantity,
            'reserved_qty', ii.reserved_qty,
            'lot_number', ii.lot_number,
            'expiry_date', ii.expiry_date
          )
        ) FILTER (WHERE p.sku IS NOT NULL) as products
      FROM locations l
      LEFT JOIN inventory_items ii ON l.id = ii.location_id
      LEFT JOIN products p ON ii.product_sku = p.sku
      WHERE l.id = $1
      GROUP BY l.id, l.zone, l.rack, l.position, l.allowed_types, l.capacity_m3, l.is_active, l.created_at, l.updated_at
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    req.logger.error('Get location error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createLocation = async (req, res) => {
  try {
    const { id, zone, rack, position, allowed_types, capacity_m3 } = req.body;

    // Check if location ID already exists
    const existing = await req.db.query('SELECT id FROM locations WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Location with this ID already exists'
      });
    }

    const result = await req.db.query(`
      INSERT INTO locations (id, zone, rack, position, allowed_types, capacity_m3, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [id, zone, rack, position, allowed_types, capacity_m3]);

    // Audit log
    await req.db.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, ['location', result.rows[0].id, 'CREATE', req.user.userId, JSON.stringify(result.rows[0])]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    req.logger.error('Create location error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
