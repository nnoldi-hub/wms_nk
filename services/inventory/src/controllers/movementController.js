// Inventory movement operations
exports.createMovement = async (req, res) => {
  const client = await req.db.connect();
  
  try {
    await client.query('BEGIN');

    const { product_sku, from_location, to_location, quantity, lot_number, notes, movement_type = 'TRANSFER' } = req.body;

    // Validate product exists
    const productResult = await client.query(
      'SELECT sku FROM products WHERE sku = $1',
      [product_sku]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    // If moving from a location, check and update inventory
    if (from_location) {
      const fromInventory = await client.query(
        'SELECT quantity FROM inventory_items WHERE product_sku = $1 AND location_id = $2 AND (lot_number = $3 OR ($3 IS NULL AND lot_number IS NULL))',
        [product_sku, from_location, lot_number]
      );

      if (fromInventory.rows.length === 0 || parseFloat(fromInventory.rows[0].quantity) < parseFloat(quantity)) {
        throw new Error('Insufficient quantity in source location');
      }

      // Decrease quantity in source location
      await client.query(`
        UPDATE inventory_items
        SET quantity = quantity - $1,
            updated_at = NOW()
        WHERE product_sku = $2 AND location_id = $3 AND (lot_number = $4 OR ($4 IS NULL AND lot_number IS NULL))
      `, [quantity, product_sku, from_location, lot_number]);
    }

    // If moving to a location, update or create inventory
    if (to_location) {
      await client.query(`
        INSERT INTO inventory_items (product_sku, location_id, quantity, lot_number)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (product_sku, location_id, lot_number)
        DO UPDATE SET 
          quantity = inventory_items.quantity + $3,
          updated_at = NOW()
      `, [product_sku, to_location, quantity, lot_number]);
    }

    // Create movement record
    const movementResult = await client.query(`
      INSERT INTO movements (
        movement_type, product_sku, from_location, to_location, 
        quantity, lot_number, user_id, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
      RETURNING *
    `, [
      movement_type, product_sku, from_location, to_location,
      quantity, lot_number, req.user.userId, notes
    ]);

    // Update completed_at
    await client.query(
      'UPDATE movements SET completed_at = NOW() WHERE id = $1',
      [movementResult.rows[0].id]
    );

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, ['movement', movementResult.rows[0].id, 'CREATE', req.user.userId, JSON.stringify(movementResult.rows[0])]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: movementResult.rows[0],
      message: 'Movement created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    req.logger.error('Create movement error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.getMovementHistory = async (req, res) => {
  try {
    const { product_sku, location_id, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT m.*, 
        p.sku, p.name as product_name,
        fl.zone as from_zone, fl.rack as from_rack, fl.position as from_position,
        tl.zone as to_zone, tl.rack as to_rack, tl.position as to_position,
        u.username as performed_by_username,
        COUNT(*) OVER() as total_count
      FROM movements m
      JOIN products p ON m.product_sku = p.sku
      LEFT JOIN locations fl ON m.from_location = fl.id
      LEFT JOIN locations tl ON m.to_location = tl.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (product_sku) {
      paramCount++;
      query += ` AND p.sku = $${paramCount}`;
      params.push(product_sku);
    }
    
    if (location_id) {
      paramCount++;
      query += ` AND (m.from_location = $${paramCount} OR m.to_location = $${paramCount})`;
      params.push(location_id);
    }

    if (start_date) {
      paramCount++;
      query += ` AND m.created_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND m.created_at <= $${paramCount}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY m.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
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
    req.logger.error('Get movement history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.adjustInventory = async (req, res) => {
  const client = await req.db.connect();
  
  try {
    await client.query('BEGIN');

    const { product_sku, location_id, new_quantity, lot_number, reason, notes } = req.body;

    // Validate product exists
    const productResult = await client.query(
      'SELECT sku FROM products WHERE sku = $1',
      [product_sku]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    // Get current inventory
    const currentInventory = await client.query(
      'SELECT quantity FROM inventory_items WHERE product_sku = $1 AND location_id = $2 AND (lot_number = $3 OR ($3 IS NULL AND lot_number IS NULL))',
      [product_sku, location_id, lot_number]
    );

    const old_quantity = currentInventory.rows.length > 0 ? parseFloat(currentInventory.rows[0].quantity) : 0;
    const quantity_diff = parseFloat(new_quantity) - old_quantity;

    // Update or create inventory
    await client.query(`
      INSERT INTO inventory_items (product_sku, location_id, quantity, lot_number)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_sku, location_id, lot_number)
      DO UPDATE SET 
        quantity = $3,
        updated_at = NOW()
    `, [product_sku, location_id, new_quantity, lot_number]);

    // Create movement record for adjustment
    const movementResult = await client.query(`
      INSERT INTO movements (
        movement_type, product_sku, to_location, 
        quantity, lot_number, user_id, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
      RETURNING *
    `, [
      'ADJUSTMENT', product_sku, location_id,
      quantity_diff, lot_number, req.user.userId, notes || reason
    ]);

    // Update completed_at
    await client.query(
      'UPDATE movements SET completed_at = NOW() WHERE id = $1',
      [movementResult.rows[0].id]
    );

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'inventory', 
      product_sku, 
      'ADJUSTMENT',
      req.user.userId,
      JSON.stringify({ old_quantity, new_quantity, quantity_diff, location_id, lot_number, reason })
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      data: {
        old_quantity,
        new_quantity,
        quantity_diff,
        movement: movementResult.rows[0]
      },
      message: 'Inventory adjusted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    req.logger.error('Adjust inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};
