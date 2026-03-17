const db = require('../config/database');
const logger = require('../config/logger');

class PutawayRulesController {
  // GET /api/v1/putaway-rules
  async list(req, res, next) {
    try {
      const result = await db.query(`
        SELECT
          pr.id,
          pr.packaging_type_code,
          pt.name AS packaging_type_name,
          pt.category AS packaging_category,
          pr.location_type_code,
          lt.name AS location_type_name,
          pr.priority,
          pr.notes,
          pr.created_at,
          pr.updated_at
        FROM putaway_rules pr
        LEFT JOIN packaging_types pt ON pt.code = pr.packaging_type_code
        LEFT JOIN location_types  lt ON lt.code = pr.location_type_code
        ORDER BY pr.packaging_type_code, pr.priority
      `);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('List putaway rules error:', error);
      next(error);
    }
  }

  // POST /api/v1/putaway-rules
  async create(req, res, next) {
    try {
      const { packaging_type_code, location_type_code, priority, notes } = req.body;
      if (!packaging_type_code || !location_type_code) {
        return res.status(400).json({ error: 'packaging_type_code and location_type_code are required' });
      }
      const result = await db.query(`
        INSERT INTO putaway_rules (packaging_type_code, location_type_code, priority, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (packaging_type_code, location_type_code)
          DO UPDATE SET priority = EXCLUDED.priority, notes = EXCLUDED.notes, updated_at = NOW()
        RETURNING *
      `, [packaging_type_code, location_type_code, priority || 10, notes || null]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Create putaway rule error:', error);
      next(error);
    }
  }

  // PUT /api/v1/putaway-rules/:id
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { priority, notes } = req.body;
      const result = await db.query(`
        UPDATE putaway_rules
        SET priority = COALESCE($1, priority),
            notes    = COALESCE($2, notes),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [priority, notes, id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Update putaway rule error:', error);
      next(error);
    }
  }

  // DELETE /api/v1/putaway-rules/:id
  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM putaway_rules WHERE id = $1 RETURNING id', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
      logger.error('Delete putaway rule error:', error);
      next(error);
    }
  }

  // POST /api/v1/putaway-rules/bulk — replace all rules for a packaging type
  async bulk(req, res, next) {
    try {
      const { packaging_type_code, rules } = req.body;
      if (!packaging_type_code || !Array.isArray(rules)) {
        return res.status(400).json({ error: 'packaging_type_code and rules[] are required' });
      }
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM putaway_rules WHERE packaging_type_code = $1', [packaging_type_code]);
        for (const rule of rules) {
          await client.query(`
            INSERT INTO putaway_rules (packaging_type_code, location_type_code, priority, notes)
            VALUES ($1, $2, $3, $4)
          `, [packaging_type_code, rule.location_type_code, rule.priority || 10, rule.notes || null]);
        }
        await client.query('COMMIT');
        res.json({ success: true, message: `${rules.length} rules saved for ${packaging_type_code}` });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Bulk putaway rules error:', error);
      next(error);
    }
  }

  // GET /api/v1/putaway-rules/suggest?packaging_type_code=COLAC
  // Returns ordered location type suggestions for a given packaging type
  async suggest(req, res, next) {
    try {
      const { packaging_type_code } = req.query;
      if (!packaging_type_code) {
        return res.status(400).json({ error: 'packaging_type_code is required' });
      }
      const result = await db.query(`
        SELECT
          pr.location_type_code,
          lt.name AS location_type_name,
          pr.priority,
          pr.notes
        FROM putaway_rules pr
        LEFT JOIN location_types lt ON lt.code = pr.location_type_code
        WHERE pr.packaging_type_code = $1
        ORDER BY pr.priority
      `, [packaging_type_code]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Suggest putaway error:', error);
      next(error);
    }
  }
}

module.exports = new PutawayRulesController();
