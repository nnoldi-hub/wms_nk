// Picking workflow controller
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { publish } = require('../utils/rabbitmqPublisher');

// URL intern Docker pentru warehouse-config (picking engine)
const WAREHOUSE_CONFIG_URL = process.env.WAREHOUSE_CONFIG_URL || 'http://wms-warehouse-config:3000';

/**
 * Apelează picking engine (non-blocking) pentru a obține strategia optimă.
 * Returnează { strategy, rule_applied_name, rule_applied_id, suggestion } sau null la eroare.
 */
async function callPickingEngine(forwardToken, productSku, requestedQty, uom, product) {
  try {
    const resp = await fetch(`${WAREHOUSE_CONFIG_URL}/api/v1/suggest/picking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(forwardToken ? { Authorization: `Bearer ${forwardToken}` } : {}),
      },
      body: JSON.stringify({ product_sku: productSku, requested_qty: requestedQty, uom, product }),
      signal: AbortSignal.timeout(3000), // max 3s
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.success) return null;
    const topRule = (data.matchedRules || [])[0];
    return {
      strategy: data.strategy || null,
      rule_applied_name: topRule?.name || null,
      rule_applied_id: topRule?.id || null,
      suggestion: data,
    };
  } catch {
    return null; // engine indisponibil — nu blochăm crearea jobului
  }
}

// Helper to extract user identity string
function getUserId(req) {
  const u = req.user || {};
  return u.sub || u.username || u.email || u.id || null;
}

// ─── Helper audit wms_ops_audit ───────────────────────────────────────────────
async function auditOp(action_type, entity_type, entity_id, entity_code, changes, extra_info, req) {
  try {
    const user = req?.user || {};
    const user_id = user.userId || user.id || user.sub || 'system';
    const user_name = user.username || user.email || user_id;
    const ip = (req?.headers?.['x-forwarded-for'] || req?.ip || null)?.split?.(',')[0]?.trim() || null;
    await req.db.query(
      `INSERT INTO wms_ops_audit (action_type, entity_type, entity_id, entity_code, service, changes, extra_info, user_id, user_name, ip_address)
       VALUES ($1, $2, $3, $4, 'inventory', $5, $6, $7, $8, $9::inet)`,
      [action_type, entity_type, entity_id || null, entity_code || null,
       changes ? JSON.stringify(changes) : null, extra_info ? JSON.stringify(extra_info) : null,
       user_id, user_name, ip]
    );
  } catch (auditErr) {
    console.warn('wms_ops_audit insert failed (non-critical):', auditErr.message);
  }
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

      // Extrage token JWT din request pentru a apela picking engine
      const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
      const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      // Create job items from sales order lines and reserve inventory (FIFO)
      const lines = await client.query('SELECT * FROM sales_order_lines WHERE order_id = $1 ORDER BY line_no', [id]);
      let jobStrategy = null;
      for (const ln of lines.rows) {
        // Consultă picking engine în paralel cu pregătirea datelor (non-blocking)
        const engineResult = await callPickingEngine(
          jwtToken,
          ln.product_sku,
          Number(ln.requested_qty) || 0,
          ln.uom || 'm',
          { category: ln.product_category || null }
        );
        if (engineResult?.strategy && !jobStrategy) jobStrategy = engineResult.strategy;

        const itemRes = await client.query(
          `INSERT INTO picking_job_items
             (job_id, line_id, product_sku, requested_qty, uom, lot_label, status,
              pick_strategy, rule_applied_name, rule_applied_id, engine_suggestion)
           VALUES ($1,$2,$3,COALESCE($4::numeric, 0.0),$5,$6,'PENDING',$7,$8,$9,$10)
           RETURNING id`,
          [
            job.id, ln.id, ln.product_sku, ln.requested_qty, ln.uom || 'm', ln.lot_label || null,
            engineResult?.strategy || null,
            engineResult?.rule_applied_name || null,
            engineResult?.rule_applied_id || null,
            engineResult?.suggestion ? JSON.stringify(engineResult.suggestion) : null,
          ]
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

      // Actualizează strategia la nivel de job (dacă a determinat-o engine-ul)
      if (jobStrategy) {
        await req.db.query(
          `UPDATE picking_jobs SET pick_strategy = $1 WHERE id = $2`,
          [jobStrategy, job.id]
        );
      }

      // Return job with items count
      const itemsCount = await req.db.query('SELECT COUNT(*)::int AS c FROM picking_job_items WHERE job_id = $1', [job.id]);
      return res.status(201).json({ success: true, data: { job, items_count: itemsCount.rows[0].c } });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      // Emit detailed server-side log to help diagnose 500s
      console.error('[allocateFromOrder] Error allocating picking job:', {
        orderId: req.params?.id,
        error: e?.message,
        stack: e?.stack
      });
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  // List picking jobs with optional filters
  async listJobs(req, res) {
    try {
      const { status, assigned_to, mine, order_id, page = 1, limit = 25 } = req.query;
      const params = [];
      let where = [];
      if (status) { params.push(status); where.push(`status = $${params.length}`); }
      let assigned = assigned_to;
      if (mine === '1' || mine === 'true') {
        assigned = getUserId(req);
      }
      if (assigned) { params.push(assigned); where.push(`assigned_to = $${params.length}`); }
      if (order_id) { params.push(order_id); where.push(`order_id = $${params.length}`); }
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
      // Allow picking also from NEW to support multi-picker without header assignment
      if (!['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(job.status)) {
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

      // Enforce/auto-assign item to current user for multi-picker workflow
      const userId = getUserId(req);
      if (!userId) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Missing user identity' }); }
      if (item.assigned_to && item.assigned_to !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: `Item assigned to ${item.assigned_to}` });
      }
      if (!item.assigned_to) {
        await client.query('UPDATE picking_job_items SET assigned_to=$1, assigned_at=now() WHERE id=$2', [userId, item.id]);
        item.assigned_to = userId; // keep local state consistent
      }

      const remaining = Number(item.requested_qty) - Number(item.picked_qty);
      const add = Math.min(remaining, q);
      const newPicked = Number(item.picked_qty) + add;
      let newStatus = newPicked >= Number(item.requested_qty) ? 'DONE' : 'PARTIAL';
      if (item.status === 'PENDING') {
        newStatus = newPicked >= Number(item.requested_qty) ? 'DONE' : 'ASSIGNED';
      }

      const upd = await client.query(
        `UPDATE picking_job_items SET picked_qty=$1, status=$2, started_at=COALESCE(started_at, now()), completed_at=CASE WHEN $2='DONE' THEN now() ELSE completed_at END WHERE id=$3 RETURNING *`,
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
      if (['NEW','ASSIGNED'].includes(job.status)) {
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
      await auditOp('PICKING_COMPLETE', 'picking_job', id, upd.rows[0]?.number,
        { items_count: items.rowCount, forced: !!force },
        { assigned_to: upd.rows[0]?.assigned_to || null },
        req
      );
      return res.json({ success: true, data: upd.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  }
  ,
  // Accept a specific job item (per-line assignment)
  async acceptJobItem(req, res) {
    const client = await req.db.connect();
    try {
      const { id, itemId } = req.params;
      const userId = getUserId(req);
      if (!userId) return res.status(400).json({ success: false, message: 'Missing user identity' });
      await client.query('BEGIN');
      const j = await client.query('SELECT id, status FROM picking_jobs WHERE id=$1', [id]);
      if (j.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job not found' }); }
      const r = await client.query('SELECT * FROM picking_job_items WHERE id=$1 AND job_id=$2 FOR UPDATE', [itemId, id]);
      if (r.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job item not found' }); }
      const item = r.rows[0];
      if (item.assigned_to && item.assigned_to !== userId) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Item already assigned to ${item.assigned_to}` });
      }
      const upd = await client.query(
        `UPDATE picking_job_items SET assigned_to=$1, assigned_at=now(), status=CASE WHEN status='PENDING' THEN 'ASSIGNED' ELSE status END WHERE id=$2 RETURNING *`,
        [userId, itemId]
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

  // Release an item assignment (optional)
  async releaseJobItem(req, res) {
    const client = await req.db.connect();
    try {
      const { id, itemId } = req.params;
      const userId = getUserId(req);
      if (!userId) return res.status(400).json({ success: false, message: 'Missing user identity' });
      await client.query('BEGIN');
      const r = await client.query('SELECT * FROM picking_job_items WHERE id=$1 AND job_id=$2 FOR UPDATE', [itemId, id]);
      if (r.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job item not found' }); }
      const item = r.rows[0];
      if (item.assigned_to && item.assigned_to !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: `Item assigned to ${item.assigned_to}` });
      }
      const upd = await client.query(
        `UPDATE picking_job_items SET assigned_to=NULL, assigned_at=NULL, started_at=NULL WHERE id=$1 RETURNING *`,
        [itemId]
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
  // Labels PDF for picked items (with QR)
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
      const labelHeight = 110;
      let x = doc.x;
      let y = doc.y;
      let col = 0;
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const picked = Number(it.picked_qty) || 0;
        if (picked <= 0) { continue; }
        if (y + labelHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          x = doc.x; y = doc.y; col = 0;
        }
        doc.rect(x, y, labelWidth, labelHeight).stroke();
        const pad = 6;
        // Text area (left)
        const textAreaWidth = labelWidth - 90 - 2 * pad; // reserve ~90px for QR
        doc.fontSize(12).text(`SKU: ${it.product_sku}`, x + pad, y + pad, { width: textAreaWidth });
        doc.fontSize(10).text(`Cant.: ${picked} ${it.uom || ''}`, { width: textAreaWidth });
        if (it.lot_label) doc.text(`Lot: ${it.lot_label}`, { width: textAreaWidth });
        doc.text(`Job: ${job.number}`, { width: textAreaWidth });
        doc.fontSize(9).fillColor('#555').text(`LBL-${idx + 1}`, { width: textAreaWidth });
        doc.fillColor('#000');

        // QR area (right)
        const qrPayload = JSON.stringify({ t: 'PICK_LABEL', sku: it.product_sku, qty: picked, uom: it.uom || null, lot: it.lot_label || null, job: job.number });
        try {
          const qrPng = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 0, width: 80, errorCorrectionLevel: 'M' });
          doc.image(qrPng, x + labelWidth - pad - 80, y + pad, { width: 80, height: 80 });
        } catch (err) {
          // If QR fails, draw a placeholder box
          doc.rect(x + labelWidth - pad - 80, y + pad, 80, 80).stroke('#999');
          doc.fontSize(8).fillColor('#999').text('QR ERR', x + labelWidth - pad - 80, y + pad + 30, { width: 80, align: 'center' });
          doc.fillColor('#000');
        }

        col++;
        if (col % 2 === 0) {
          x = doc.x; y += labelHeight + 10; col = 0;
        } else {
          x += labelWidth + 20;
        }
      }
      doc.end();
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // Labels PDF for reservations (pre-pick labels)
  async labelsReservedPdf(req, res) {
    try {
      const { id } = req.params; // job id
      const j = await req.db.query('SELECT * FROM picking_jobs WHERE id = $1', [id]);
      if (j.rowCount === 0) return res.status(404).json({ success: false, message: 'Job not found' });
      const job = j.rows[0];
      // Get reservations with remaining qty (reserved_qty > 0)
      const r = await req.db.query(
        `SELECT r.id, r.product_sku, r.reserved_qty, r.uom, ii.lot_number
         FROM inventory_reservations r
         LEFT JOIN inventory_items ii ON ii.id = r.inventory_item_id
         WHERE r.job_id = $1 AND r.reserved_qty > 0
         ORDER BY r.created_at ASC`,
        [id]
      );
      const items = r.rows;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=${job.number}_reserved_labels.pdf`);
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.pipe(res);

      doc.fontSize(14).text(`Etichete rezervări job ${job.number}`, { align: 'left' });
      doc.moveDown(0.5);
      const labelWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2 - 10;
      const labelHeight = 110;
      let x = doc.x;
      let y = doc.y;
      let col = 0;
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const qty = Number(it.reserved_qty) || 0;
        if (qty <= 0) { continue; }
        if (y + labelHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          x = doc.x; y = doc.y; col = 0;
        }
        doc.rect(x, y, labelWidth, labelHeight).stroke();
        const pad = 6;
        const textAreaWidth = labelWidth - 90 - 2 * pad;
        doc.fontSize(12).text(`SKU: ${it.product_sku}`, x + pad, y + pad, { width: textAreaWidth });
        doc.fontSize(10).text(`Cant. rezervată: ${qty} ${it.uom || ''}`, { width: textAreaWidth });
        if (it.lot_number) doc.text(`Lot: ${it.lot_number}`, { width: textAreaWidth });
        doc.text(`Job: ${job.number}`, { width: textAreaWidth });
        doc.fontSize(9).fillColor('#555').text(`RSV-${idx + 1}`, { width: textAreaWidth });
        doc.fillColor('#000');

        const qrPayload = JSON.stringify({ t: 'PICK_RSV', sku: it.product_sku, qty, uom: it.uom || null, lot: it.lot_number || null, job: job.number });
        try {
          const qrPng = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 0, width: 80, errorCorrectionLevel: 'M' });
          doc.image(qrPng, x + labelWidth - pad - 80, y + pad, { width: 80, height: 80 });
        } catch (err) {
          doc.rect(x + labelWidth - pad - 80, y + pad, 80, 80).stroke('#999');
          doc.fontSize(8).fillColor('#999').text('QR ERR', x + labelWidth - pad - 80, y + pad + 30, { width: 80, align: 'center' });
          doc.fillColor('#000');
        }

        col++;
        if (col % 2 === 0) {
          x = doc.x; y += labelHeight + 10; col = 0;
        } else {
          x += labelWidth + 20;
        }
      }
      doc.end();
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // List items, supports mine=1, status, pagination
  async listItems(req, res) {
    try {
      const { mine, status, page = 1, limit = 50 } = req.query;
      const params = [];
      let where = [];
      if (mine === '1' || mine === 'true') {
        const userId = getUserId(req);
        if (!userId) return res.status(400).json({ success: false, message: 'Missing user identity' });
        params.push(userId); where.push(`pji.assigned_to = $${params.length}`);
      }
      if (status) { params.push(status); where.push(`pji.status = $${params.length}`); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const offset = (Number(page) - 1) * Number(limit);
      const total = await req.db.query(`SELECT COUNT(*)::int AS c FROM picking_job_items pji ${whereSql}`, params);
      params.push(limit, offset);
      const rows = await req.db.query(
        `SELECT pji.*, pj.number AS job_number, pj.id AS job_id
         FROM picking_job_items pji
         JOIN picking_jobs pj ON pj.id = pji.job_id
         ${whereSql}
         ORDER BY pji.updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return res.json({ success: true, data: rows.rows, pagination: { page: Number(page), limit: Number(limit), total: total.rows[0].c } });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  /**
   * POST /pick-jobs/:id/assign
   * Manager/admin asignează explicit un job unui operator.
   * Body: { operator_id: string, priority?: 'NORMAL'|'URGENT'|'CRITIC' }
   * Publică pick-job.assigned pe RabbitMQ → notifications-service → WebSocket operator.
   */
  async assignJob(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params;
      const { operator_id, priority = 'NORMAL' } = req.body || {};
      if (!operator_id) return res.status(400).json({ success: false, message: 'operator_id is required' });
      if (!['NORMAL', 'URGENT', 'CRITIC'].includes(priority)) {
        return res.status(400).json({ success: false, message: 'priority trebuie să fie NORMAL, URGENT sau CRITIC' });
      }

      await client.query('BEGIN');
      const j = await client.query('SELECT * FROM picking_jobs WHERE id = $1 FOR UPDATE', [id]);
      if (j.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job negăsit' }); }
      const job = j.rows[0];
      if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Nu se poate asigna un job ${job.status}` });
      }

      const upd = await client.query(
        `UPDATE picking_jobs
            SET assigned_to = $1,
                assigned_at = now(),
                priority = $2,
                accept_deadline = now() + interval '5 minutes',
                status = 'ASSIGNED'
          WHERE id = $3
          RETURNING *`,
        [operator_id, priority, id]
      );
      await client.query('COMMIT');

      const updatedJob = upd.rows[0];

      // Publică eveniment RabbitMQ → notifications-service îl va trimite pe WebSocket
      const itemsCount = await req.db.query(
        'SELECT COUNT(*)::int AS c FROM picking_job_items WHERE job_id = $1', [id]
      );
      publish('pick-job.assigned', {
        jobId: id,
        operatorId: operator_id,
        priority,
        orderRef: updatedJob.order_ref || null,
        itemsCount: itemsCount.rows[0].c,
        assignedBy: getUserId(req),
        userId: operator_id, // notifications-service folosește userId pt room user:{userId}
      });

      return res.json({ success: true, data: updatedJob });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  // Supervisor: reassign all items of a job to another worker
  async reassignJob(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params;
      const { assigned_to } = req.body || {};
      if (!assigned_to) return res.status(400).json({ success: false, message: 'assigned_to is required' });

      await client.query('BEGIN');
      const j = await client.query('SELECT id, status FROM picking_jobs WHERE id = $1', [id]);
      if (j.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Job not found' }); }
      const job = j.rows[0];
      if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Cannot reassign a ${job.status} job` });
      }

      // Reassign job header
      await client.query('UPDATE picking_jobs SET assigned_to = $1, status = CASE WHEN status = \'NEW\' THEN \'NEW\' ELSE status END WHERE id = $2', [assigned_to, id]);
      // Reassign all pending/assigned items
      await client.query(
        `UPDATE picking_job_items SET assigned_to = $1, assigned_at = now()
         WHERE job_id = $2 AND status NOT IN ('DONE','CANCELLED')`,
        [assigned_to, id]
      );

      await client.query('COMMIT');
      const updated = await req.db.query('SELECT * FROM picking_jobs WHERE id = $1', [id]);
      return res.json({ success: true, data: updated.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  /**
   * POST /pick-jobs/:id/move-to-shipping
   * Mută un picking job completat în zona de expediere.
   * - Actualizează picking_jobs.status → 'DISPATCHED'
   * - Actualizează sales_orders.status → 'READY_FOR_LOADING' (dacă are order_id)
   */
  async moveToShipping(req, res) {
    const client = await req.db.connect();
    try {
      const { id } = req.params;
      await client.query('BEGIN');
      const j = await client.query('SELECT * FROM picking_jobs WHERE id = $1 FOR UPDATE', [id]);
      if (j.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Job negasit' });
      }
      const job = j.rows[0];
      if (!['COMPLETED', 'IN_PROGRESS'].includes(job.status)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Job trebuie sa fie COMPLETED sau IN_PROGRESS (actual: ${job.status})` });
      }

      // Actualizează job
      const updJob = await client.query(
        `UPDATE picking_jobs SET status = 'DISPATCHED', notes = COALESCE(NULLIF(notes,''), '') || ' [Mutat expediere]' WHERE id = $1 RETURNING *`,
        [id]
      );

      let updOrder = null;
      if (job.order_id) {
        updOrder = await client.query(
          `UPDATE sales_orders SET status = 'READY_FOR_LOADING' WHERE id = $1 AND status NOT IN ('LOADED','DELIVERED','CANCELLED') RETURNING *`,
          [job.order_id]
        );
      }

      await client.query('COMMIT');
      return res.json({
        success: true,
        data: {
          job: updJob.rows[0],
          order: updOrder?.rows[0] ?? null
        }
      });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  },

  /**
   * Înregistrează o tăiere fizică dintr-un lot de produs.
   * POST /pick-jobs/:id/items/:itemId/cut   * Body: { cut_qty, source_batch_id, remainder_location_id? }
   *
   * Fluxul:
   * 1. Verifică job + item din picking
   * 2. Verifică batch-ul sursă
   * 3. Calculează restul = batch.current_quantity - cut_qty
   * 4. Dacă există rest, creează un batch NOU în stoc pentru restul de cablu
   * 5. Înregistrează transformarea în product_transformations (tip CUT)
   * 6. Marchează batch-ul original ca EMPTY (consumat fizic)
   * 7. Marchează picking item ca DONE cu picked_qty = cut_qty
   */
  async cutItem(req, res) {
    const client = await req.db.connect();
    try {
      const { id, itemId } = req.params;
      const { cut_qty, source_batch_id, remainder_location_id } = req.body || {};

      const cutQty = Number(cut_qty);
      if (!source_batch_id || !Number.isFinite(cutQty) || cutQty <= 0) {
        return res.status(400).json({ success: false, message: 'Furnizati source_batch_id si cut_qty pozitiv' });
      }

      await client.query('BEGIN');

      // 1. Job valid
      const jobRes = await client.query('SELECT * FROM picking_jobs WHERE id = $1 FOR UPDATE', [id]);
      if (jobRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Job negasit' });
      }
      const job = jobRes.rows[0];
      if (!['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(job.status)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Nu se poate taia pe job cu status ${job.status}` });
      }

      // 2. Item valid
      const itemRes = await client.query('SELECT * FROM picking_job_items WHERE id = $1 AND job_id = $2 FOR UPDATE', [itemId, id]);
      if (itemRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Linie negasita' });
      }
      const item = itemRes.rows[0];
      if (item.status === 'DONE') {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Linia este deja finalizata' });
      }

      // 3. Batch sursă
      const batchRes = await client.query('SELECT * FROM product_batches WHERE id = $1 FOR UPDATE', [source_batch_id]);
      if (batchRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Batch sursa negasit' });
      }
      const batch = batchRes.rows[0];

      const batchQty = Number(batch.current_quantity);
      if (cutQty > batchQty + 0.001) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Cant. taiata (${cutQty}) depaseste cantitatea disponibila in batch (${batchQty})`
        });
      }

      const remainder = Math.max(0, batchQty - cutQty);

      // 4. Creeaza batch NOU pentru rest (dacă există rest semnificativ)
      let newBatch = null;
      if (remainder > 0.001) {
        const ratio = remainder / batchQty;
        const remainderWeight = batch.weight_kg ? (Number(batch.weight_kg) * ratio).toFixed(3) : null;
        const remainderLength = batch.length_meters ? (Number(batch.length_meters) * ratio).toFixed(2) : null;
        const locationForRemainder = remainder_location_id || batch.location_id;

        const newBatchRes = await client.query(
          `INSERT INTO product_batches
             (product_sku, unit_id, initial_quantity, current_quantity, length_meters,
              weight_kg, status, location_id, source_batch_id, notes)
           VALUES ($1, $2, $3, $3, $4, $5, 'INTACT', $6, $7, $8)
           RETURNING *`,
          [
            batch.product_sku,
            batch.unit_id,
            remainder,
            remainderLength,
            remainderWeight,
            locationForRemainder,
            batch.id,
            `Rest din taiere - Job ${job.number} - ${item.product_sku || ''} - Lot: ${item.lot_label || batch.batch_number}`
          ]
        );
        newBatch = newBatchRes.rows[0];
      }

      // 5. Înregistrează transformarea (tip CUT)
      const transRes = await client.query(
        `INSERT INTO product_transformations
           (type, source_batch_id, source_quantity, result_batch_id, result_quantity,
            waste_quantity, selection_method, notes)
         VALUES ('CUT', $1, $2, $3, $4, 0, 'MANUAL', $5)
         RETURNING *`,
        [
          batch.id,
          batchQty,
          newBatch?.id || null,
          remainder,
          `Picking Job ${job.number} - Taiere ${cutQty} ${item.uom || ''} din batch ${batch.batch_number}`
        ]
      );
      const transformation = transRes.rows[0];

      // 6. Marchează batch-ul original ca EMPTY + leagă transformarea
      await client.query(
        `UPDATE product_batches
         SET status = 'EMPTY', current_quantity = 0, emptied_at = now(),
             transformation_id = $1, updated_at = now()
         WHERE id = $2`,
        [transformation.id, batch.id]
      );

      // 7. Actualizează picking item
      const newExtraInfo = Object.assign({}, item.extra_info || {}, {
        cut_qty: cutQty,
        remainder_qty: remainder,
        remainder_batch_id: newBatch?.id || null,
        remainder_batch_number: newBatch?.batch_number || null,
        source_batch_id: batch.id,
        source_batch_number: batch.batch_number,
        transformation_id: transformation.id
      });
      const updatedItem = await client.query(
        `UPDATE picking_job_items
         SET picked_qty = $1, status = 'DONE',
             started_at = COALESCE(started_at, now()), completed_at = now(),
             extra_info = $2::jsonb
         WHERE id = $3 RETURNING *`,
        [cutQty, JSON.stringify(newExtraInfo), itemId]
      );

      // 8. Aduce job-ul în IN_PROGRESS dacă era NEW/ASSIGNED
      if (['NEW', 'ASSIGNED'].includes(job.status)) {
        await client.query(
          `UPDATE picking_jobs SET status = 'IN_PROGRESS', started_at = now() WHERE id = $1`,
          [id]
        );
      }

      await client.query('COMMIT');
      return res.json({
        success: true,
        data: {
          item: updatedItem.rows[0],
          transformation,
          remainder_batch: newBatch,
          source_batch_number: batch.batch_number,
          cut_qty: cutQty,
          remainder_qty: remainder
        }
      });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error('[cutItem] Error:', e?.message, e?.stack);
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      client.release();
    }
  }
};
