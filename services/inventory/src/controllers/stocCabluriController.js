/**
 * Import stoc inițial cabluri din CSV cu format:
 *   Produs, Lot intrare, Cantitate
 * Cantitate = km (se convertește în metri)
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');
const logger = require('../utils/logger');
const { parseLotIntrare } = require('../utils/lotParser');
const { pool } = require('../config/database');

// ─── Generare SKU din denumire produs ─────────────────────────────────────────
function makeSkuFromName(name) {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-\.\/\+]/g, '')
    .substring(0, 80);
}

// ─── Detectare tip produs din lot + denumire ───────────────────────────────────
function detecteazaTip(productName) {
  const n = productName.toUpperCase();
  if (n.includes('ALARMA')) return 'ALARMA';
  if (n.includes('COAX') || n.includes('RG59') || n.includes('RG6')) return 'COAXIAL';
  if (n.includes('SOLAR') || n.includes('H1Z2Z2')) return 'SOLAR';
  if (n.includes('ACSR') || n.includes('ACYABY') || n.includes('AC2XABY') || n.includes('ACBYCY')) return 'LEA';
  if (n.includes('ARE4H5EX') && n.includes('12/20')) return 'MT';
  if (n.includes('ARE4') || n.includes('AUE4')) return 'JT_ARMAT';
  if (n.includes('CYABY') || n.includes('CYABZY')) return 'JT_ARMAT';
  if (n.includes('CYY')) return 'JT_NEARMAT';
  if (n.includes('CSYY') || n.includes('CABLU ALARMA')) return 'SEMNALIZARE';
  return 'CABLU_GENERIC';
}

// ─── Parseaza CSV ──────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    const normalizer = new Transform({
      transform(chunk, _enc, cb) {
        // Nu normaliza separatorii — câmpul "Lot intrare" are spații interne
        this.push(chunk);
        cb();
      }
    });

    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(normalizer)
      .pipe(csv({
        separator: ',',
        mapHeaders: ({ header }) => header.trim().toLowerCase()
          .replace(/\s+/g, '_')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, ''), // strip diacritice
        skipLines: 0,
      }))
      .on('data', (row) => {
        // Coloane așteptate: produs, lot_intrare, cantitate
        const produs = (row['produs'] || row['product'] || '').trim();
        const lot = (row['lot_intrare'] || row['lot'] || row['lot intrare'] || '').trim();
        const cantitate = parseFloat(row['cantitate'] || row['quantity'] || '0');

        if (produs) {
          rows.push({ produs, lot, cantitate_km: isNaN(cantitate) ? 0 : cantitate });
        }
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ─── Controller ────────────────────────────────────────────────────────────────

class StocCabluriController {

  /**
   * POST /api/v1/import-stoc-cabluri
   * Acceptă: multipart file upload (CSV) cu header Produs,Lot intrare,Cantitate
   * Body opțional: dry_run=true (preview fără salvare)
   */
  async importStocCabluri(req, res, next) {
    let client;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Lipsă fișier CSV' });
      }

      const filePath = req.file.path;
      const dryRun = req.body.dry_run === 'true';

      logger.info(`[StocCabluri] Procesare fișier: ${req.file.originalname}, dry_run=${dryRun}`);

      let rawRows;
      try {
        rawRows = await parseCSV(filePath);
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, error: `Eroare parsare CSV: ${err.message}` });
      }

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      if (rawRows.length === 0) {
        return res.status(400).json({ success: false, error: 'CSV gol sau fără rânduri valide' });
      }

      // Procesare + parsare lot
      const processed = rawRows.map((r, idx) => {
        const sku = makeSkuFromName(r.produs);
        const lotData = parseLotIntrare(r.lot);
        const meters = Math.round(r.cantitate_km * 1000 * 10) / 10; // km → m, 1 zecimală
        const productType = detecteazaTip(r.produs);

        return {
          row: idx + 2, // +2 (1-indexed + header)
          sku,
          name: r.produs,
          lot_raw: r.lot,
          lot: lotData,
          cantitate_km: r.cantitate_km,
          meters,
          product_type: productType,
        };
      });

      if (dryRun) {
        return res.json({
          success: true,
          dry_run: true,
          total_rows: processed.length,
          unique_products: new Set(processed.map(r => r.sku)).size,
          rows: processed,
        });
      }

      // ── Import în DB ─────────────────────────────────────────────────────
      client = await pool.connect();
      await client.query('BEGIN');

      // Rezolvă unit_id pentru METER (folosit pentru toate loturi de cablu)
      const unitRes = await client.query(
        `SELECT id FROM product_units WHERE code = 'METER' LIMIT 1`
      );
      const meterUnitId = unitRes.rows[0]?.id;
      if (!meterUnitId) {
        await client.query('ROLLBACK');
        return res.status(500).json({ success: false, error: "Unitatea 'METER' lipsă din product_units" });
      }

      let createdProducts = 0;
      let updatedProducts = 0;
      let createdBatches = 0;
      const errors = [];

      for (const row of processed) {
        try {
          // Upsert produs
          const prodInsert = await client.query(
            `INSERT INTO products (sku, name, uom, description, lot_control)
             VALUES ($1, $2, 'METER', $3, true)
             ON CONFLICT (sku) DO UPDATE
               SET name = EXCLUDED.name
             RETURNING (xmax = 0) AS inserted`,
            [
              row.sku,
              row.name,
              `Tip: ${row.product_type} | Import stoc inițial — ${row.lot.packaging_type || 'necunoscut'}${row.lot.manufacturer ? ' / ' + row.lot.manufacturer : ''}`,
            ]
          );
          if (prodInsert.rows[0]?.inserted) createdProducts++;
          else updatedProducts++;

          if (row.meters > 0) {
            // Construiește notes cu info lot complet
            const notes = [
              `Lot: ${row.lot_raw}`,
              row.lot.tambur_code ? `Tambur: ${row.lot.tambur_code}` : null,
              row.lot.manufacturer ? `Producător: ${row.lot.manufacturer}` : null,
              row.lot.marking_start != null ? `Marcare: ${row.lot.marking_start}-${row.lot.marking_end}` : null,
              `Import inițial ${new Date().toISOString().slice(0, 10)}`,
            ].filter(Boolean).join(' | ');

            await client.query(
              `INSERT INTO product_batches
                 (product_sku, unit_id, initial_quantity, current_quantity, notes, status, length_meters)
               VALUES ($1, $2, $3, $3, $4, 'INTACT', $3)`,
              [
                row.sku,
                meterUnitId,
                row.meters,
                notes,
              ]
            );
            createdBatches++;
          }
        } catch (rowErr) {
          logger.warn(`[StocCabluri] Eroare rând ${row.row}: ${rowErr.message}`);
          errors.push({ row: row.row, sku: row.sku, name: row.name, error: rowErr.message });
        }
      }

      await client.query('COMMIT');

      logger.info(`[StocCabluri] Import complet: ${createdProducts} produse noi, ${updatedProducts} updatate, ${createdBatches} batches`);

      res.status(201).json({
        success: true,
        dry_run: false,
        stats: {
          total_rows: processed.length,
          created_products: createdProducts,
          updated_products: updatedProducts,
          created_batches: createdBatches,
          errors: errors.length,
        },
        errors,
      });

    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      logger.error('[StocCabluri] Import eșuat:', err);
      next(err);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * POST /api/v1/import-stoc-cabluri/preview
   * Acceptă JSON body: { rows: [{produs, lot_intrare, cantitate}] }
   * Returnează parsare completă fără a scrie în DB (pentru preview din frontend)
   */
  async preview(req, res, next) {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'rows[] obligatoriu' });
      }

      const processed = rows.map((r, idx) => {
        const produs = (r.produs || r.product_name || '').trim();
        const lot = (r.lot_intrare || r.lot || '').trim();
        const cantitate_km = parseFloat(r.cantitate || r.quantity || '0') || 0;

        const sku = makeSkuFromName(produs);
        const lotData = parseLotIntrare(lot);
        const meters = Math.round(cantitate_km * 1000 * 10) / 10;
        const productType = detecteazaTip(produs);

        return {
          row: idx + 2,
          sku,
          name: produs,
          lot_raw: lot,
          lot: lotData,
          cantitate_km,
          meters,
          product_type: productType,
        };
      });

      // Sumar per produs
      const byProduct = {};
      for (const r of processed) {
        if (!byProduct[r.sku]) byProduct[r.sku] = { name: r.name, sku: r.sku, type: r.product_type, total_meters: 0, batches: 0 };
        byProduct[r.sku].total_meters += r.meters;
        byProduct[r.sku].batches++;
      }

      res.json({
        success: true,
        total_rows: processed.length,
        unique_products: Object.keys(byProduct).length,
        product_summary: Object.values(byProduct).sort((a, b) => a.name.localeCompare(b.name)),
        rows: processed,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StocCabluriController();
