// Picking workflow controller
const PDFDocument = require('pdfkit');

// Helper to extract user identity string
function getUserId(req) {
  const u = req.user || {};
  return u.sub || u.username || u.email || u.id || null;
}

module.exports = {
  // Create a picking job from a sales order and generate items per line
  async allocateFromOrder(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params; // sales order id
      // Validate order exists
      const o = await client.query('SELECT id, number FROM sales_orders WHERE id = $1', [id]);
      if (o.rowCount === 0) return res.status(404).json({ success: false, message: 'Order not found' });

      await client.query('BEGIN');
      // Check if a job already exists for this order
      const existing = await client.query('SELECT * FROM picking_jobs WHERE order_id = $1 AND status <> $2', [id, 'CANCELLED']);
      if (existing.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Picking job already exists for this order', data: existing.rows[0] });
      }

      // Generate job number via DB function
      const numRes = await client.query("SELECT generate_picking_job_number() AS num");
      const jobNumber = numRes.rows[0].num;

      // Create job header
      const j = await client.query(
        `INSERT INTO picking_jobs (order_id, number, status)
         VALUES ($1,$2,'NEW') RETURNING *`,
        [id, jobNumber]
      );
      const job = j.rows[0];

      // Create job items from sales order lines and reserve inventory (FIFO)
      const lines = await client.query('SELECT * FROM sales_order_lines WHERE order_id = $1 ORDER BY line_no', [id]);
      for (const ln of lines.rows) {
        const itemRes = await client.query(
          `INSERT INTO picking_job_items (job_id, line_id, product_sku, requested_qty, uom, lot_label, status)
           VALUES ($1,$2,$3,COALESCE($4,0),$5,$6,'PENDING') RETURNING id`,
          [job.id, ln.id, ln.product_sku, ln.requested_qty, ln.uom || 'm', ln.lot_label || null]
        );
        const jobItemId = itemRes.rows[0].id;

        // Reserve inventory
        let toReserve = Number(ln.requested_qty) || 0;
        if (toReserve <= 0) continue;
        const invParams = [ln.product_sku];
        let sqlInv = `SELECT id, product_sku, quantity, reserved_qty, lot_number
                      FROM inventory_items
                      WHERE product_sku = $1 AND (quantity - reserved_qty) > 0`;
        if (ln.lot_label) { invParams.push(ln.lot_label); sqlInv += ` AND lot_number = $${invParams.length}`; }
        sqlInv += ' ORDER BY created_at ASC';
        const inv = await client.query(sqlInv, invParams);
        for (const it of inv.rows) {
          if (toReserve <= 0) break;
          const available = Number(it.quantity) - Number(it.reserved_qty);
          if (available <= 0) continue;
          const take = Math.min(available, toReserve);
          await client.query(
            `INSERT INTO inventory_reservations (order_id, line_id, job_id, inventory_item_id, product_sku, reserved_qty, uom)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, ln.id, job.id, it.id, ln.product_sku, take, (ln.uom || 'm')]
          );
          await client.query('UPDATE inventory_items SET reserved_qty = reserved_qty + $1 WHERE id = $2', [take, it.id]);
          toReserve -= take;
        }
      }

      await client.query('COMMIT');
      // Return job with items count
      const itemsCount = await req.db.query('SELECT COUNT(*)::int AS c FROM picking_job_items WHERE job_id = $1', [job.id]);
      return res.status(201).json({ success: true, data: { job, items_count: itemsCount.rows[0].c } });
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  // List picking jobs with optional filters
  async listJobs(req, res) {
    try {
      const { status, assigned_to, mine, page = 1, limit = 25 } = req.query;
      const params = [];
      let where = [];
      if (status) { params.push(status); where.push(`status = $${params.length}`); }
      let assigned = assigned_to;
      if (mine === '1' || mine === 'true') {
        assigned = getUserId(req);
      }
      if (assigned) { params.push(assigned); where.push(`assigned_to = $${params.length}`); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const offset = (Number(page) - 1) * Number(limit);
      const total = await req.db.query(`SELECT COUNT(*)::int AS c FROM picking_jobs ${whereSql}`, params);
      params.push(limit); params.push(offset);
      const rows = await req.db.query(
        `SELECT * FROM picking_jobs ${whereSql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return res.json({ success: true, data: rows.rows, pagination: { page: Number(page), limit: Number(limit), total: total.rows[0].c } });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // Get job with items
  async getJob(req, res) {
    try {
      const { id } = req.params;
      const j = await req.db.query('SELECT * FROM picking_jobs WHERE id = $1', [id]);
      if (j.rowCount === 0) return res.status(404).json({ success: false, message: 'Job not found' });
      const items = await req.db.query('SELECT * FROM picking_job_items WHERE job_id = $1 ORDER BY created_at', [id]);
      return res.json({ success: true, data: { job: j.rows[0], items: items.rows } });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // Accept a job (assign to current user if NEW)
  async acceptJob(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      if (!userId) return res.status(400).json({ success: false, message: 'Missing user identity' });
      await client.query('BEGIN');
      const j = await client.query('SELECT * FROM picking_jobs WHERE id = $1 FOR UPDATE', [id]);
      if (j.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job not found' }); }
      const job = j.rows[0];
      if (job.status !== 'NEW' && !(job.status === 'ASSIGNED' && job.assigned_to === userId)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Job not available for accept (status=${job.status})` });
      }
      const upd = await client.query(
        `UPDATE picking_jobs SET status='ASSIGNED', assigned_to=$1, assigned_at=now() WHERE id=$2 RETURNING *`,
        [userId, id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: upd.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  // Record a pick scan for an item (by sku and optional lot)
  async pickItem(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params; // job id
      const { sku, qty, lot_label, item_id } = req.body || {};
      const q = Number(qty);
      if (!(item_id || sku) || !Number.isFinite(q) || q <= 0) {
        return res.status(400).json({ success: false, message: 'Provide item_id or sku and positive qty' });
      }
      await client.query('BEGIN');
      const j = await client.query('SELECT * FROM picking_jobs WHERE id = $1 FOR UPDATE', [id]);
      if (j.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job not found' }); }
      const job = j.rows[0];
      if (!['ASSIGNED', 'IN_PROGRESS'].includes(job.status)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Cannot pick on job with status ${job.status}` });
      }

      // Select item row
      let item;
      if (item_id) {
        const r = await client.query('SELECT * FROM picking_job_items WHERE id = $1 AND job_id = $2 FOR UPDATE', [item_id, id]);
        if (r.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job item not found' }); }
        item = r.rows[0];
      } else {
        const params = [id, sku];
        let sql = 'SELECT * FROM picking_job_items WHERE job_id = $1 AND product_sku = $2';
        if (lot_label) { params.push(lot_label); sql += ` AND (lot_label = $${params.length} OR lot_label IS NULL)`; }
        sql += ' ORDER BY created_at FOR UPDATE';
        const r = await client.query(sql, params);
        if (r.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Matching job item not found' }); }
        // pick first that is not yet done
        item = r.rows.find(x => Number(x.requested_qty) > Number(x.picked_qty)) || r.rows[0];
      }

      const remaining = Number(item.requested_qty) - Number(item.picked_qty);
      const add = Math.min(remaining, q);
      const newPicked = Number(item.picked_qty) + add;
      const newStatus = newPicked >= Number(item.requested_qty) ? 'DONE' : 'PARTIAL';

      const upd = await client.query(
        `UPDATE picking_job_items SET picked_qty=$1, status=$2 WHERE id=$3 RETURNING *`,
        [newPicked, newStatus, item.id]
      );

      // Consume reservations for this line (FIFO) and move stock to staging
      let toConsume = add;
      if (toConsume > 0 && item.line_id) {
        const rsv = await client.query('SELECT id, inventory_item_id, reserved_qty FROM inventory_reservations WHERE job_id = $1 AND line_id = $2 AND (released_at IS NULL OR released_at IS NULL) AND reserved_qty > 0 ORDER BY created_at ASC', [id, item.line_id]);
        const STAGING = process.env.STAGING_LOCATION_ID || 'DELIVERY';
        for (const r of rsv.rows) {
          if (toConsume <= 0) break;
          const consume = Math.min(Number(r.reserved_qty), toConsume);
          // Reduce reservation balance
          await client.query('UPDATE inventory_reservations SET reserved_qty = reserved_qty - $1 WHERE id = $2', [consume, r.id]);
          // Fetch source inventory item and update quantities
          const itRes = await client.query('SELECT id, product_sku, location_id, lot_number FROM inventory_items WHERE id = $1 FOR UPDATE', [r.inventory_item_id]);
          if (itRes.rowCount > 0) {
            const it = itRes.rows[0];
            await client.query('UPDATE inventory_items SET reserved_qty = reserved_qty - $1, quantity = quantity - $1 WHERE id = $2', [consume, it.id]);
            // Upsert into staging
            await client.query(
              `INSERT INTO inventory_items (product_sku, location_id, quantity, lot_number)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (product_sku, location_id, lot_number)
               DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity, updated_at = now()`,
              [it.product_sku, STAGING, consume, it.lot_number]
            );
            // Movement record
            await client.query(
              `INSERT INTO movements (movement_type, product_sku, from_location, to_location, quantity, lot_number, user_id, status, notes)
               VALUES ('PICK_TO_STAGING', $1, $2, $3, $4, $5, $6, 'completed', $7)`,
              [it.product_sku, it.location_id, STAGING, consume, it.lot_number, req.user?.userId || null, `Pick job ${job.number} item ${item.product_sku}`]
            );
            await client.query('UPDATE movements SET completed_at = now() WHERE id = (SELECT id FROM movements ORDER BY created_at DESC LIMIT 1)');
          }
          toConsume -= consume;
        }
      }

      // If job was ASSIGNED, move to IN_PROGRESS on first pick
      if (job.status === 'ASSIGNED') {
        await client.query(`UPDATE picking_jobs SET status='IN_PROGRESS', started_at=now() WHERE id=$1`, [id]);
      }

      await client.query('COMMIT');
      return res.json({ success: true, data: upd.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  // Complete a job when all items are DONE
  async completeJob(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params;
      const { force } = req.body || {};
      await client.query('BEGIN');
      const items = await client.query('SELECT status FROM picking_job_items WHERE job_id = $1', [id]);
      if (items.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job items not found' }); }
      const allDone = items.rows.every(r => r.status === 'DONE');
      if (!allDone && !force) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Not all items are DONE. Use force=true to override.' });
      }
      const upd = await client.query(
        `UPDATE picking_jobs SET status='COMPLETED', completed_at=now() WHERE id=$1 RETURNING *`,
        [id]
      );

      // Release any remaining reservations for this job
      const rsv = await client.query('SELECT id, inventory_item_id, reserved_qty FROM inventory_reservations WHERE job_id = $1 AND reserved_qty > 0', [id]);
      for (const r of rsv.rows) {
        await client.query('UPDATE inventory_items SET reserved_qty = reserved_qty - $1 WHERE id = $2', [r.reserved_qty, r.inventory_item_id]);
        await client.query('UPDATE inventory_reservations SET released_at = now(), reserved_qty = 0 WHERE id = $1', [r.id]);
      }
      await client.query('COMMIT');
      return res.json({ success: true, data: upd.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  }
  ,
  // Labels PDF for picked items (simple MVP)
  async labelsPdf(req, res) {
    try {
      const { id } = req.params;
      const j = await req.db.query('SELECT * FROM picking_jobs WHERE id = $1', [id]);
      if (j.rowCount === 0) return res.status(404).json({ success: false, message: 'Job not found' });
      const job = j.rows[0];
      const itemsRes = await req.db.query('SELECT * FROM picking_job_items WHERE job_id = $1 ORDER BY created_at', [id]);
      const items = itemsRes.rows;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=${job.number}_labels.pdf`);
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.pipe(res);

      doc.fontSize(14).text(`Etichete job ${job.number}`, { align: 'left' });
      doc.moveDown(0.5);
      const labelWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2 - 10;
      const labelHeight = 90;
      let x = doc.x;
      let y = doc.y;
      let col = 0;
      items.forEach((it, idx) => {
        const picked = Number(it.picked_qty) || 0;
        if (picked <= 0) return;
        if (y + labelHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          x = doc.x; y = doc.y; col = 0;
        }
        doc.rect(x, y, labelWidth, labelHeight).stroke();
        const pad = 6;
        doc.fontSize(12).text(`SKU: ${it.product_sku}`, x + pad, y + pad, { width: labelWidth - 2 * pad });
        doc.fontSize(10).text(`Cant.: ${picked} ${it.uom || ''}`, { width: labelWidth - 2 * pad });
        if (it.lot_label) doc.text(`Lot: ${it.lot_label}`, { width: labelWidth - 2 * pad });
        doc.text(`Job: ${job.number}`, { width: labelWidth - 2 * pad });
        doc.fontSize(9).fillColor('#555').text(`LBL-${idx + 1}`, { width: labelWidth - 2 * pad });
        doc.fillColor('#000');
        col++;
        if (col % 2 === 0) {
          x = doc.x; y += labelHeight + 10; col = 0;
        } else {
          x += labelWidth + 20;
        }
      });
      doc.end();
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }
};
