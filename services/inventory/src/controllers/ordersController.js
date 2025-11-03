const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const multer = require('multer');
const PDFDocument = require('pdfkit');

// Storage for CSV uploads (reuses services/inventory/uploads)
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

function toLowerKeys(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    out[String(k).toLowerCase().trim()] = obj[k];
  }
  return out;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  // Replace comma decimal if needed
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function generateCmdNumber(client) {
  const res = await client.query("SELECT 'CMD_' || LPAD(nextval('sales_order_cmd_seq')::TEXT, 5, '0') AS num");
  return res.rows[0].num;
}

async function importCsv(req, res) {
  const client = await req.db.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Upload a CSV file in field "file"' });
    }

    const rows = await new Promise((resolve, reject) => {
      const acc = [];
      fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ',', skipLines: 0 }))
        .on('data', (row) => acc.push(toLowerKeys(row)))
        .on('end', () => resolve(acc))
        .on('error', reject);
    });

    fs.unlink(req.file.path, () => {});

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV is empty' });
    }

    // Expected flexible columns
    // order_number, date, customer, address, contact, delivery_type, agent, sku, qty, uom, requested_lengths, note, management_code, lot_label
    // Group by order_number (or create one if missing)
    const groups = new Map();
    for (const r0 of rows) {
      const r = r0;
      const orderNo = (r.order_number || r.comanda || '').trim();
      const key = orderNo || '__AUTO__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    await client.query('BEGIN');
    const created = [];

    for (const [key, lines] of groups.entries()) {
      const first = lines[0];
      const customer = (first.customer || first.client || '').trim();
      const address = (first.address || first.adresa || '').trim();
      const contact = (first.contact || first.persona || first['persoana contact'] || '').trim();
      const deliveryType = (first.delivery_type || first.tip_livrare || '').trim();
      const agent = (first.agent || first.agent_name || '').trim();
      const orderNumber = key === '__AUTO__' ? await generateCmdNumber(client) : key;

      // Create order header
      const oRes = await client.query(
        `INSERT INTO sales_orders (number, customer_name, delivery_address, contact_name, delivery_type, agent_name, status)
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING')
         RETURNING id, number`,
        [orderNumber, customer, address, contact, deliveryType, agent]
      );
      const orderId = oRes.rows[0].id;

      let lineNo = 0;
      let totalWeight = 0;
      for (const r of lines) {
        lineNo += 1;
        const sku = (r.sku || r['cod produs'] || r.code || '').trim();
        if (!sku) continue;
        const desc = r.description || r['denumire articol'] || null;
        const qty = parseNumber(r.qty || r.cantitate || r['cantitate de']);
        const uom = (r.uom || r.um || 'Km').trim();
        const mgmt = (r.management_code || r['cod gest.'] || r.cod_gest || null);
        const lotLabel = (r.lot_label || r['lot intrare'] || r.lot || null);
        const reqLengths = (r.requested_lengths || r['lungimi solicitate'] || '').trim();
        const lengthsJson = reqLengths ? JSON.stringify(
          reqLengths.split(/[+;,]/).map(s => parseNumber(s)).filter(v => v)
        ) : null;
        const weight = parseNumber(r.line_weight || r.greutate);
        if (weight) totalWeight += weight;

        // Ensure product exists (upsert minimal record)
        await client.query(
          `INSERT INTO products (sku, name, uom)
           VALUES ($1, COALESCE($2,$4), $3)
           ON CONFLICT (sku) DO NOTHING`,
          [sku, desc, uom.toLowerCase() === 'km' ? 'm' : uom, sku]
        );

        await client.query(
          `INSERT INTO sales_order_lines
            (order_id, line_no, product_sku, description, requested_qty, uom, requested_lengths, management_code, lot_label, line_weight)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [orderId, lineNo, sku, desc, qty || 0, uom, lengthsJson, mgmt, lotLabel, weight]
        );
      }

      await client.query('UPDATE sales_orders SET total_weight = $1 WHERE id = $2', [totalWeight || null, orderId]);
      created.push({ id: orderId, number: oRes.rows[0].number, lines: lines.length });
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, data: { orders: created } });
  } catch (err) {
    await client.query('ROLLBACK');
    req.logger?.error('Import orders CSV failed', err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

async function listOrders(req, res) {
  try {
    const { page = 1, limit = 25 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const total = await req.db.query('SELECT COUNT(*)::int AS c FROM sales_orders');
    const rows = await req.db.query(
      `SELECT * FROM sales_orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ success: true, data: rows.rows, pagination: { page: Number(page), limit: Number(limit), total: total.rows[0].c } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

async function getOrder(req, res) {
  try {
    const { id } = req.params;
    const o = await req.db.query('SELECT * FROM sales_orders WHERE id = $1', [id]);
    if (o.rowCount === 0) return res.status(404).json({ success: false, message: 'Order not found' });
    const lines = await req.db.query('SELECT * FROM sales_order_lines WHERE order_id = $1 ORDER BY line_no', [id]);
    return res.json({ success: true, data: { order: o.rows[0], lines: lines.rows } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = {
  upload,
  importCsv,
  listOrders,
  getOrder,
  async pickNotePdf(req, res) {
    try {
      const { id } = req.params;
      const o = await req.db.query('SELECT * FROM sales_orders WHERE id = $1', [id]);
      if (o.rowCount === 0) return res.status(404).json({ success: false, message: 'Order not found' });
      const order = o.rows[0];
      const linesRes = await req.db.query('SELECT * FROM sales_order_lines WHERE order_id = $1 ORDER BY line_no', [id]);
      const lines = linesRes.rows;

  // Prepare PDF (landscape by default to avoid column clipping)
  const layout = (req.query.layout === 'portrait' ? 'portrait' : 'landscape');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=${order.number}_pick_note.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 36, layout });
      doc.pipe(res);

  // Header
  const createdAt = order.created_at || order.order_date;
  doc.fontSize(16).text('NK SMART CABLES', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(11).text(`Nota de culegere ${order.number} din data ${createdAt ? new Date(createdAt).toLocaleDateString('ro-RO') : ''}`);
      doc.moveDown(0.5);

      // Partner box
      const y0 = doc.y;
      doc.fontSize(10);
      doc.text(`Partener: ${order.customer_name || ''}`);
      if (order.delivery_address) doc.text(`Adresa: ${order.delivery_address}`);
      if (order.contact_name) doc.text(`Persoana de contact: ${order.contact_name}`);
      doc.moveDown(0.5);

      // Table header (auto-fit to printable width)
      const hasLengths = Array.isArray(lines)
        ? lines.some((ln) => {
            const v = ln.requested_lengths;
            if (!v) return false;
            try {
              const arr = JSON.parse(v);
              return Array.isArray(arr) && arr.length > 0;
            } catch {
              return false;
            }
          })
        : false;

      let headers = hasLengths
        ? ['Denumire articol', 'Cod gest.', 'UM', 'Cantitate', 'Lot intrare', 'Greutate', 'Lungimi solicitate']
        : ['Denumire articol', 'Cod gest.', 'UM', 'Cantitate', 'Lot intrare', 'Greutate'];

      const getPrintableWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
      // Column proportions (sum ~1)
      const COL_PERC = hasLengths
        ? [0.30, 0.09, 0.06, 0.10, 0.18, 0.07, 0.20]
        : [0.35, 0.12, 0.07, 0.12, 0.24, 0.10];

      const computeColWidths = () => {
        const w = getPrintableWidth();
        const arr = COL_PERC.map((p) => Math.floor(w * p));
        const sum = arr.reduce((a, b) => a + b, 0);
        arr[arr.length - 1] += (w - sum); // fix rounding
        return arr;
      };
      let colWidths = computeColWidths();
      const xStart = doc.x;
      let x = xStart;
      const rowHeight = 20;

      const drawHeaderRow = () => {
        // Recompute widths per page (in case of different orientation)
        colWidths = computeColWidths();
        // Header row with light background
        doc.save();
        doc.font('Helvetica-Bold');
        const yHeader = doc.y;
        let xh = xStart;
        headers.forEach((h, idx) => {
          doc.rect(xh, yHeader, colWidths[idx], rowHeight).fillAndStroke('#f0f0f0', '#000');
          doc.fillColor('#000').text(h, xh + 3, yHeader + 4, { width: colWidths[idx] - 6 });
          xh += colWidths[idx];
        });
        doc.restore();
        doc.moveDown();
        doc.y += 2; // small spacing
      };

      drawHeaderRow();

  // Rows
  doc.font('Helvetica');
  doc.fontSize(10);
      const toStr = (v) => (v === null || v === undefined ? '' : String(v));
  const fmtQty = (v) => (v === null || v === undefined ? '' : Number(v).toFixed(2).replace(/\.00$/, ''));
      let totalWeight = 0;

      const pageHeight = () => doc.page.height;
      const bottomMargin = () => doc.page.margins.bottom;
      for (const ln of lines) {
        // Page break check
        if (doc.y + rowHeight + 10 > pageHeight() - bottomMargin()) {
          doc.addPage();
          drawHeaderRow();
        }
        x = xStart;
        const baseValues = [
          toStr(ln.description || ln.product_sku),
          toStr(ln.management_code || ''),
          toStr(ln.uom || ''),
          fmtQty(ln.requested_qty),
          toStr(ln.lot_label || ''),
          toStr(ln.line_weight || ''),
        ];
        const values = hasLengths
          ? [
              ...baseValues,
              (() => {
                const v = ln.requested_lengths;
                if (!v) return '';
                try {
                  const arr = JSON.parse(v);
                  return Array.isArray(arr) ? arr.join('+') : '';
                } catch {
                  return '';
                }
              })(),
            ]
          : baseValues;
        if (ln.line_weight) totalWeight += Number(ln.line_weight);

        // Determine dynamic row height based on wrapped content (Denumire si Lungimi pot fi mai lungi)
        const calcHeightForCell = (text, colIdx) => {
          const w = colWidths[colIdx] - 6;
          const useCourier = colIdx === 4; // Lot intrare monospace for alignment
          const prevFont = doc._font && doc._font.name;
          if (useCourier) doc.font('Courier'); else doc.font('Helvetica');
          const h = doc.heightOfString(text || '', { width: w });
          if (prevFont) doc.font(prevFont);
          return Math.max(rowHeight, h + 8); // add padding
        };
        let cellHeight = rowHeight;
        for (let i = 0; i < values.length; i++) {
          // Only compute wrap for potential long columns to keep it efficient
          if (i === 0 || i === 4 || (hasLengths && i === 6)) {
            cellHeight = Math.max(cellHeight, calcHeightForCell(values[i], i));
          }
        }

        // Page break check again with computed height
        if (doc.y + cellHeight + 10 > pageHeight() - bottomMargin()) {
          doc.addPage();
          drawHeaderRow();
        }

        const yRow = doc.y;
        const numericCols = new Set([3, 5]); // Cantitate, Greutate
        for (let i = 0; i < values.length; i++) {
          // Borders
          doc.rect(x, yRow, colWidths[i], cellHeight).stroke();
          const align = numericCols.has(i) ? 'right' : 'left';
          // Font: monospace pentru Lot intrare
          if (i === 4) doc.font('Courier'); else doc.font('Helvetica');
          doc.text(values[i], x + 3, yRow + 4, { width: colWidths[i] - 6, align });
          x += colWidths[i];
        }
        doc.font('Helvetica');
        doc.y = yRow + cellHeight; // move to next row
      }

      doc.moveDown(1);
  doc.font('Helvetica-Bold').text(`Greutate comanda: ${totalWeight ? totalWeight.toFixed(2) : '—'}`);
      doc.moveDown(0.5);
      doc.font('Helvetica').text(`Tip livrare: ${order.delivery_type || ''}`);
      doc.text(`Agent: ${order.agent_name || ''}`);

      doc.end();
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }
};
