/**
 * pickNotesController.js
 * Controller pentru Note de Culegere (ERP picking notes)
 *
 * Endpoints:
 *   GET  /pick-notes                  — lista note (cu filtre)
 *   GET  /pick-notes/:id              — detaliu + linii
 *   POST /pick-notes/erp-webhook      — import automat de la ERP (webhook push)
 *   POST /pick-notes/import-json      — import manual JSON (format ERP)
 *   POST /pick-notes/:id/generate-picking  — generează job de picking din nota
 *   POST /pick-notes/:id/cancel       — anulează nota
 */

const ERP_WEBHOOK_SECRET = process.env.ERP_WEBHOOK_SECRET || '';

// ─── helpers ────────────────────────────────────────────────────────────────

function validateWebhookSecret(req, res) {
  if (!ERP_WEBHOOK_SECRET) return true; // secret not configured → open
  const provided = req.headers['x-erp-secret'] || req.query.secret || '';
  if (provided !== ERP_WEBHOOK_SECRET) {
    res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    return false;
  }
  return true;
}

/**
 * Parse a nota de culegere JSON payload (from ERP or manual upload).
 * Accepts the canonical format:
 * {
 *   erp_cmd_number: "CMD_116731",
 *   erp_date: "2026-03-12",
 *   partner_name: "CER ELECTRO AVG S.R.L.",
 *   contact_person: "CROITORU GEO",
 *   agent_name: "DOBRESCU DANIEL",
 *   delivery_type: "TRANSPORT NK SMART CABLES",
 *   total_weight: 331.40,
 *   lines: [
 *     {
 *       product_name: "CYY-F 5X2.5 NYY-FR",
 *       stock_code: "VZCB_CMP",
 *       length_available: 0.812,
 *       quantity_to_pick: 0.500,
 *       uom: "Km",
 *       lot_number: "##E1000 POWERVINE 0-1012 1012 M",
 *       quantity_remaining: 0.312,
 *       weight: 147.50,
 *       requested_lengths: ""
 *     }, ...
 *   ]
 * }
 */
function parsePayload(body) {
  const errors = [];
  if (!body.erp_cmd_number) errors.push('erp_cmd_number este obligatoriu');
  if (!Array.isArray(body.lines) || body.lines.length === 0)
    errors.push('lines trebuie sa fie un array nevid');
  body.lines?.forEach((l, i) => {
    if (!l.quantity_to_pick && l.quantity_to_pick !== 0)
      errors.push(`Linia ${i + 1}: quantity_to_pick lipseste`);
  });
  return errors;
}

// ─── controller ─────────────────────────────────────────────────────────────

const PickNotesController = {

  // GET /pick-notes
  async list(req, res) {
    try {
      const { status, source, partner, page = 1, limit = 25 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const params = [];
      const where = ['1=1'];

      if (status) { params.push(status); where.push(`pn.status = $${params.length}`); }
      if (source) { params.push(source); where.push(`pn.source = $${params.length}`); }
      if (partner) { params.push(`%${partner}%`); where.push(`pn.partner_name ILIKE $${params.length}`); }

      params.push(Number(limit), offset);
      const rows = await req.db.query(
        `SELECT pn.*,
                COUNT(pnl.id)::int AS line_count
           FROM pick_notes pn
           LEFT JOIN pick_note_lines pnl ON pnl.pick_note_id = pn.id
          WHERE ${where.join(' AND ')}
          GROUP BY pn.id
          ORDER BY pn.erp_date DESC NULLS LAST, pn.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const count = await req.db.query(
        `SELECT COUNT(*) FROM pick_notes pn WHERE ${where.join(' AND ')}`,
        params.slice(0, params.length - 2)
      );

      res.json({
        success: true,
        data: rows.rows,
        total: Number(count.rows[0].count),
        page: Number(page),
        limit: Number(limit),
      });
    } catch (err) {
      req.logger?.error('pick-notes list error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /pick-notes/:id
  async getOne(req, res) {
    try {
      const { id } = req.params;
      const noteRes = await req.db.query(
        'SELECT * FROM pick_notes WHERE id = $1',
        [id]
      );
      if (!noteRes.rows.length)
        return res.status(404).json({ success: false, error: 'Nota negasita' });

      const linesRes = await req.db.query(
        'SELECT * FROM pick_note_lines WHERE pick_note_id = $1 ORDER BY line_number',
        [id]
      );

      res.json({
        success: true,
        data: { ...noteRes.rows[0], lines: linesRes.rows },
      });
    } catch (err) {
      req.logger?.error('pick-notes getOne error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /pick-notes/erp-webhook
  // Apelat automat de ERP cand se creeaza o nota noua
  async erpWebhook(req, res) {
    if (!validateWebhookSecret(req, res)) return;
    return PickNotesController._importNote(req, res, 'ERP_WEBHOOK');
  },

  // POST /pick-notes/import-json
  // Incarcare manuala JSON de catre utilizator
  async importJson(req, res) {
    return PickNotesController._importNote(req, res, 'MANUAL_UPLOAD');
  },

  // Shared import logic
  async _importNote(req, res, source) {
    try {
      const body = req.body;
      const errors = parsePayload(body);
      if (errors.length)
        return res.status(400).json({ success: false, errors });

      const client = await req.db.connect();
      try {
        await client.query('BEGIN');

        // Insert or update nota (upsert by erp_cmd_number)
        const existing = await client.query(
          'SELECT id, status FROM pick_notes WHERE erp_cmd_number = $1',
          [body.erp_cmd_number]
        );

        if (existing.rows.length && existing.rows[0].status === 'COMPLETED') {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: `Nota ${body.erp_cmd_number} este deja COMPLETATA. Anulati-o inainte de reimport.`,
          });
        }

        let noteId;
        if (existing.rows.length) {
          // Update header, recreate lines
          noteId = existing.rows[0].id;
          await client.query(
            `UPDATE pick_notes SET
               erp_date=$1, partner_name=$2, contact_person=$3, agent_name=$4,
               delivery_type=$5, total_weight=$6, source=$7, notes=$8,
               erp_raw=$9, status='PENDING', updated_at=NOW()
             WHERE id=$10`,
            [
              body.erp_date || null,
              body.partner_name || null,
              body.contact_person || null,
              body.agent_name || null,
              body.delivery_type || null,
              body.total_weight || null,
              source,
              body.notes || null,
              JSON.stringify(body),
              noteId,
            ]
          );
          await client.query('DELETE FROM pick_note_lines WHERE pick_note_id = $1', [noteId]);
        } else {
          const ins = await client.query(
            `INSERT INTO pick_notes
               (erp_cmd_number, erp_date, partner_name, contact_person, agent_name,
                delivery_type, total_weight, source, notes, erp_raw, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING id`,
            [
              body.erp_cmd_number,
              body.erp_date || null,
              body.partner_name || null,
              body.contact_person || null,
              body.agent_name || null,
              body.delivery_type || null,
              body.total_weight || null,
              source,
              body.notes || null,
              JSON.stringify(body),
              req.user?.username || null,
            ]
          );
          noteId = ins.rows[0].id;
        }

        // Insert lines
        for (let i = 0; i < body.lines.length; i++) {
          const l = body.lines[i];
          await client.query(
            `INSERT INTO pick_note_lines
               (pick_note_id, line_number, product_name, stock_code,
                length_available, quantity_to_pick, uom, lot_number,
                quantity_remaining, weight, requested_lengths)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              noteId,
              i + 1,
              l.product_name || null,
              l.stock_code || null,
              l.length_available || null,
              l.quantity_to_pick,
              l.uom || 'Km',
              l.lot_number || null,
              l.quantity_remaining || null,
              l.weight || null,
              l.requested_lengths || null,
            ]
          );
        }

        await client.query('COMMIT');

        const result = await req.db.query(
          `SELECT pn.*, json_agg(pnl ORDER BY pnl.line_number) AS lines
             FROM pick_notes pn
             JOIN pick_note_lines pnl ON pnl.pick_note_id = pn.id
            WHERE pn.id = $1
            GROUP BY pn.id`,
          [noteId]
        );

        req.logger?.info(`pick-note imported [${source}]: ${body.erp_cmd_number}`);
        res.status(existing.rows.length ? 200 : 201).json({
          success: true,
          data: result.rows[0],
          updated: !!existing.rows.length,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      req.logger?.error('pick-notes import error', err);
      if (err.code === '23505')
        return res.status(409).json({ success: false, error: 'Nota cu acest CMD deja exista' });
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /pick-notes/:id/generate-picking
  // Generează unul sau mai multe picking jobs (suport multi-muncitor)
  //
  // Body (single worker - backward compat):
  //   { assigned_to: "username" }
  //
  // Body (multi-worker):
  //   {
  //     workers: [{username:"ion"}, {username:"gheorghe"}, {}],  // array de muncitori
  //     strategy: "round_robin" | "by_weight"                    // default: round_robin
  //   }
  async generatePicking(req, res) {
    try {
      const { id } = req.params;
      const { assigned_to, workers, strategy = 'round_robin' } = req.body;

      const noteRes = await req.db.query(
        'SELECT * FROM pick_notes WHERE id = $1',
        [id]
      );
      if (!noteRes.rows.length)
        return res.status(404).json({ success: false, error: 'Nota negasita' });

      const note = noteRes.rows[0];
      if (note.status === 'CANCELLED')
        return res.status(400).json({ success: false, error: 'Nota este anulata' });
      if (note.picking_job_id) {
        return res.json({
          success: true,
          data: { picking_job_id: note.picking_job_id },
          message: 'Picking job deja generat pentru aceasta nota',
        });
      }

      const linesRes = await req.db.query(
        'SELECT * FROM pick_note_lines WHERE pick_note_id = $1 AND status != $2 ORDER BY line_number',
        [id, 'CANCELLED']
      );
      if (!linesRes.rows.length)
        return res.status(400).json({ success: false, error: 'Nicio linie activa in nota' });

      const lines = linesRes.rows;

      // ── Determina muncitorii ──────────────────────────────────────────────
      // Normalizăm la un array de username-uri (string | null)
      let workerList = [];
      if (Array.isArray(workers) && workers.length > 1) {
        workerList = workers.map(w => w?.username || null);
      } else {
        workerList = [assigned_to || null]; // single job (backward compat)
      }
      const numWorkers = workerList.length;

      // ── Distribuie liniile pe muncitori ───────────────────────────────────
      // Rezultat: workerLines[i] = array de linii pentru muncitorul i
      const workerLines = Array.from({ length: numWorkers }, () => []);

      if (strategy === 'by_weight') {
        // Greedy balanced by weight: sortăm liniile descrescător după greutate
        // și le asignăm muncitorului cu totalul curent cel mai mic
        const totals = new Array(numWorkers).fill(0);
        const sortedByWeight = [...lines].sort(
          (a, b) => (b.weight || b.quantity_to_pick || 0) - (a.weight || a.quantity_to_pick || 0)
        );
        for (const line of sortedByWeight) {
          const minIdx = totals.indexOf(Math.min(...totals));
          workerLines[minIdx].push(line);
          totals[minIdx] += line.weight || line.quantity_to_pick || 0;
        }
      } else {
        // round_robin (implicit)
        lines.forEach((line, i) => workerLines[i % numWorkers].push(line));
      }

      const client = await req.db.connect();
      try {
        await client.query('BEGIN');

        const createdJobs = [];
        const ts = Date.now().toString().slice(-5);

        for (let wi = 0; wi < numWorkers; wi++) {
          const wLines = workerLines[wi];
          if (!wLines.length) continue; // skip empty buckets

          const workerUser = workerList[wi];
          const suffix = numWorkers > 1 ? `-W${wi + 1}` : '';
          const jobNum = `PK-${note.erp_cmd_number}${suffix}-${ts}`;

          const jobRes = await client.query(
            `INSERT INTO picking_jobs
               (number, order_id, assigned_to, status, notes)
             VALUES ($1, NULL, $2, 'NEW', $3)
             RETURNING id`,
            [
              jobNum,
              workerUser,
              `Nota culegere ${note.erp_cmd_number} — ${note.partner_name || ''}` +
                (numWorkers > 1 ? ` [Muncitor ${wi + 1}/${numWorkers}]` : ''),
            ]
          );
          const jobId = jobRes.rows[0].id;

          for (const line of wLines) {
            const itemRes = await client.query(
              `INSERT INTO picking_job_items
                 (job_id, product_sku, requested_qty, uom, lot_label, extra_info, status)
               VALUES ($1,$2,$3,$4,$5,$6,'PENDING')
               RETURNING id`,
              [
                jobId,
                line.stock_code || null,
                line.quantity_to_pick,
                line.uom || 'Km',
                line.lot_number || null,
                JSON.stringify({
                  product_name: line.product_name || '',
                  length_available: line.length_available,
                  quantity_remaining: line.quantity_remaining,
                  requested_lengths: line.requested_lengths,
                }),
              ]
            );

            await client.query(
              'UPDATE pick_note_lines SET picking_item_id = $1, status = $2 WHERE id = $3',
              [itemRes.rows[0].id, 'IN_PROGRESS', line.id]
            );
          }

          createdJobs.push({
            picking_job_id: jobId,
            job_number: jobNum,
            assigned_to: workerUser,
            items_count: wLines.length,
          });
        }

        // Actualizăm nota — picking_job_id = primul job (backward compat)
        await client.query(
          `UPDATE pick_notes SET picking_job_id = $1, status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $2`,
          [createdJobs[0].picking_job_id, id]
        );

        await client.query('COMMIT');

        req.logger?.info(
          `${createdJobs.length} picking job(s) generated from pick-note ${id} (strategy=${strategy})`
        );

        // Backward compat: dacă e un singur job returnăm și câmpurile vechi
        const firstJob = createdJobs[0];
        res.status(201).json({
          success: true,
          data: {
            picking_job_id: firstJob.picking_job_id,
            job_number: firstJob.job_number,
            items_count: lines.length,
            jobs: createdJobs,         // array complet (pentru UI multi-worker)
            total_jobs: createdJobs.length,
          },
          message:
            createdJobs.length === 1
              ? `Job ${firstJob.job_number} creat cu ${lines.length} articole`
              : `${createdJobs.length} joburi de picking create cu ${lines.length} articole total`,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      req.logger?.error('pick-notes generate-picking error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /pick-notes/:id/cancel
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const result = await req.db.query(
        `UPDATE pick_notes SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('COMPLETED','CANCELLED')
         RETURNING id, erp_cmd_number, status`,
        [id]
      );
      if (!result.rows.length)
        return res.status(400).json({ success: false, error: 'Nota nu poate fi anulata (stare invalida sau negasita)' });

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      req.logger?.error('pick-notes cancel error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = PickNotesController;
