const QRCode = require('qrcode');

/**
 * Assign product to a warehouse location
 * POST /api/v1/inventory/assign-location
 */
exports.assignProductToLocation = async (req, res) => {
  const client = await req.db.connect();
  
  try {
    const { product_sku, location_id, quantity, lot_number, expiry_date } = req.body;
    const userId = req.user?.id;

    // Validate input
    if (!product_sku || !location_id || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'product_sku, location_id, and quantity are required',
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0',
      });
    }

    await client.query('BEGIN');

    // 1. Check if product exists
    const productCheck = await client.query(
      'SELECT sku, name, uom FROM products WHERE sku = $1',
      [product_sku]
    );

    if (productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const product = productCheck.rows[0];

    // 2. Check if location exists and is available
    const locationCheck = await client.query(`
      SELECT l.*, wz.zone_code, wz.zone_name, w.warehouse_code, w.warehouse_name
      FROM locations l
      JOIN warehouse_zones wz ON l.zone_id = wz.id
      JOIN warehouses w ON wz.warehouse_id = w.id
      WHERE l.id = $1 AND (l.is_active = true OR l.is_active IS NULL)
    `, [location_id]);

    if (locationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Location not found or inactive',
      });
    }

    const location = locationCheck.rows[0];

    if (location.status === 'BLOCKED' || location.status === 'MAINTENANCE') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Cannot assign to ${location.status} location`,
      });
    }

    // 3. Generate QR code data
    const qr_code_data = {
      type: 'PRODUCT_LOCATION',
      sku: product_sku,
      product_name: product.name,
      warehouse_code: location.warehouse_code,
      warehouse_name: location.warehouse_name,
      zone_code: location.zone_code,
      zone_name: location.zone_name,
      location_code: location.location_code,
      aisle: location.aisle,
      rack: location.rack,
      level: location.shelf_level,
      bin: location.bin_position,
      quantity: parseFloat(quantity),
      uom: product.uom,
      lot_number: lot_number || null,
      expiry_date: expiry_date || null,
      assigned_at: new Date().toISOString(),
    };

    // 4. Check if inventory item already exists for this product-location combination
    const existingInventory = await client.query(
      'SELECT id, quantity FROM inventory_items WHERE product_sku = $1 AND location_id = $2',
      [product_sku, location_id]
    );

    let inventoryItemId;
    let isNew = false;

    if (existingInventory.rows.length > 0) {
      // Update existing inventory item
      const newQuantity = parseFloat(existingInventory.rows[0].quantity) + parseFloat(quantity);
      
      await client.query(`
        UPDATE inventory_items
        SET quantity = $1, qr_code_data = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [newQuantity, JSON.stringify(qr_code_data), existingInventory.rows[0].id]);

      inventoryItemId = existingInventory.rows[0].id;
      req.logger.info(`Updated inventory item ${inventoryItemId} - new quantity: ${newQuantity}`);
    } else {
      // Create new inventory item
      const inventoryResult = await client.query(`
        INSERT INTO inventory_items (
          product_sku, warehouse_id, zone_id, location_id, 
          quantity, lot_number, expiry_date, qr_code_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        product_sku,
        location.warehouse_id,
        location.zone_id,
        location_id,
        quantity,
        lot_number || null,
        expiry_date || null,
        JSON.stringify(qr_code_data),
      ]);

      inventoryItemId = inventoryResult.rows[0].id;
      isNew = true;
      req.logger.info(`Created new inventory item ${inventoryItemId}`);
    }

    // 5. Create inventory movement record (IN)
    await client.query(`
      INSERT INTO inventory_movements (
        product_sku, location_id, movement_type, quantity, 
        lot_number, expiry_date, notes, performed_by
      )
      VALUES ($1, $2, 'IN', $3, $4, $5, $6, $7)
    `, [
      product_sku,
      location_id,
      quantity,
      lot_number || null,
      expiry_date || null,
      `Product assigned to location via web UI`,
      userId,
    ]);

    // 6. Update location status to OCCUPIED
    await client.query(`
      UPDATE locations
      SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [location_id]);

    await client.query('COMMIT');

    req.logger.info(`Product ${product_sku} assigned to location ${location.location_code} (${quantity} ${product.uom})`);

    res.json({
      success: true,
      message: 'Product assigned to location successfully',
      inventory_item_id: inventoryItemId,
      is_new: isNew,
      qr_code_data,
      location_updated: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    req.logger.error('Assign product to location error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * Get inventory items for a product
 * GET /api/v1/inventory/product/:sku
 */
exports.getProductInventory = async (req, res) => {
  try {
    const { sku } = req.params;

    const result = await req.db.query(`
      SELECT 
        ii.*,
        l.location_code,
        l.aisle,
        l.rack,
        l.shelf_level,
        l.bin_position,
        wz.zone_code,
        wz.zone_name,
        w.warehouse_code,
        w.warehouse_name
      FROM inventory_items ii
      JOIN locations l ON ii.location_id = l.id
      JOIN warehouse_zones wz ON ii.zone_id = wz.id
      JOIN warehouses w ON ii.warehouse_id = w.id
      WHERE ii.product_sku = $1
      ORDER BY ii.created_at DESC
    `, [sku]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    req.logger.error('Get product inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get inventory items for a location
 * GET /api/v1/inventory/location/:locationId
 */
exports.getLocationInventory = async (req, res) => {
  try {
    const { locationId } = req.params;

    const result = await req.db.query(`
      SELECT 
        ii.*,
        p.name as product_name,
        p.uom
      FROM inventory_items ii
      JOIN products p ON ii.product_sku = p.sku
      WHERE ii.location_id = $1
      ORDER BY p.name
    `, [locationId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    req.logger.error('Get location inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Generate QR code image for inventory item
 * GET /api/v1/inventory/qr/:inventoryItemId
 */
exports.generateQRCode = async (req, res) => {
  try {
    const { inventoryItemId } = req.params;

    const result = await req.db.query(
      'SELECT qr_code_data FROM inventory_items WHERE id = $1',
      [inventoryItemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found',
      });
    }

    const qrData = result.rows[0].qr_code_data;

    // Generate QR code image
    const qrImageUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    res.json({
      success: true,
      qr_data: qrData,
      qr_image_url: qrImageUrl,
    });
  } catch (error) {
    req.logger.error('Generate QR code error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get stock summary by warehouse/zone/location
 * GET /api/v1/inventory/stock-summary
 */
exports.getStockSummary = async (req, res) => {
  try {
    const { warehouse_id, zone_id, location_id } = req.query;

    let query = `
      SELECT 
        p.sku as product_sku,
        p.name as product_name,
        l.location_code,
        SUM(ii.quantity) as total_quantity,
        p.uom,
        COUNT(DISTINCT ii.location_id) as location_count
      FROM inventory_items ii
      JOIN products p ON ii.product_sku = p.sku
      JOIN locations l ON ii.location_id = l.id
      WHERE 1=1
    `;

    const params = [];

    if (warehouse_id) {
      params.push(warehouse_id);
      query += ` AND ii.warehouse_id = $${params.length}`;
    }

    if (zone_id) {
      params.push(zone_id);
      query += ` AND ii.zone_id = $${params.length}`;
    }

    if (location_id) {
      params.push(location_id);
      query += ` AND ii.location_id = $${params.length}`;
    }

    query += ` GROUP BY p.sku, p.name, l.location_code, p.uom ORDER BY p.name`;

    const result = await req.db.query(query, params);

    const summary = {
      total_products: result.rows.length,
      total_locations: result.rows.reduce((sum, row) => sum + parseInt(row.location_count), 0),
      total_quantity: result.rows.reduce((sum, row) => sum + parseFloat(row.total_quantity), 0),
      items: result.rows,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    req.logger.error('Get stock summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
