const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class WorkflowController {
  // States
  async listStates(req, res, next) {
    try {
      const { warehouseId } = req.params;
      const result = await db.query(
        'SELECT * FROM workflow_states WHERE (warehouse_id = $1 OR warehouse_id IS NULL) AND is_active = true ORDER BY display_order NULLS LAST, state_name',
        [warehouseId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('List workflow states error:', error);
      next(error);
    }
  }

  async createState(req, res, next) {
    try {
      const data = req.validatedBody || req.body;
      const id = uuidv4();
      const result = await db.query(`
        INSERT INTO workflow_states (
          id, warehouse_id, state_code, state_name, state_category, color, icon,
          is_initial_state, is_final_state, requires_location, allows_batch_modification, is_active, is_system, display_order
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13
        ) RETURNING *
      `, [
        id, data.warehouse_id || null, data.state_code, data.state_name, data.state_category, data.color, data.icon,
        data.is_initial_state || false, data.is_final_state || false, data.requires_location || false, data.allows_batch_modification || false,
        data.is_system !== false, data.display_order || null
      ]);
      res.status(201).json({ success: true, message: 'Workflow state created', data: result.rows[0] });
    } catch (error) {
      logger.error('Create workflow state error:', error);
      next(error);
    }
  }

  async updateState(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body;
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'No fields to update' });
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map(k => data[k]);
      values.push(id);
      const result = await db.query(
        `UPDATE workflow_states SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Workflow state not found' });
      res.json({ success: true, message: 'Workflow state updated', data: result.rows[0] });
    } catch (error) {
      logger.error('Update workflow state error:', error);
      next(error);
    }
  }

  // Transitions
  async listTransitions(req, res, next) {
    try {
      const { warehouseId } = req.params;
      const result = await db.query(`
        SELECT wt.*, fs.state_code AS from_code, ts.state_code AS to_code
        FROM workflow_transitions wt
        JOIN workflow_states fs ON wt.from_state_id = fs.id
        JOIN workflow_states ts ON wt.to_state_id = ts.id
        WHERE wt.warehouse_id = $1 OR wt.warehouse_id IS NULL
        ORDER BY fs.display_order NULLS LAST, ts.display_order NULLS LAST
      `, [warehouseId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('List workflow transitions error:', error);
      next(error);
    }
  }

  async createTransition(req, res, next) {
    try {
      const data = req.validatedBody || req.body;
      const id = uuidv4();
      const result = await db.query(`
        INSERT INTO workflow_transitions (
          id, warehouse_id, from_state_id, to_state_id, transition_name,
          required_role, requires_approval, approver_role,
          is_automatic, auto_transition_delay_minutes, conditions, is_active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true
        ) RETURNING *
      `, [
        id, data.warehouse_id || null, data.from_state_id, data.to_state_id, data.transition_name,
        data.required_role || null, data.requires_approval || false, data.approver_role || null,
        data.is_automatic || false, data.auto_transition_delay_minutes || null, data.conditions || null
      ]);
      res.status(201).json({ success: true, message: 'Workflow transition created', data: result.rows[0] });
    } catch (error) {
      logger.error('Create workflow transition error:', error);
      next(error);
    }
  }

  async updateTransition(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body;
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'No fields to update' });
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map(k => data[k]);
      values.push(id);
      const result = await db.query(
        `UPDATE workflow_transitions SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Workflow transition not found' });
      res.json({ success: true, message: 'Workflow transition updated', data: result.rows[0] });
    } catch (error) {
      logger.error('Update workflow transition error:', error);
      next(error);
    }
  }

  // Validate if a transition is allowed for a role between two states
  async validateTransition(req, res, next) {
    try {
      const { warehouse_id, from_state_id, to_state_id, role } = req.body;
      const result = await db.query(`
        SELECT * FROM workflow_transitions
        WHERE (warehouse_id = $1 OR warehouse_id IS NULL)
          AND from_state_id = $2 AND to_state_id = $3
          AND is_active = true
      `, [warehouse_id || null, from_state_id, to_state_id]);

      if (!result.rows.length) {
        return res.json({ success: true, allowed: false, reason: 'No transition configured' });
      }

      const tr = result.rows[0];
      if (tr.required_role && tr.required_role !== role) {
        return res.json({ success: true, allowed: false, reason: 'Role not permitted' });
      }

      return res.json({ success: true, allowed: true, transition: tr });
    } catch (error) {
      logger.error('Validate transition error:', error);
      next(error);
    }
  }
}

module.exports = new WorkflowController();
