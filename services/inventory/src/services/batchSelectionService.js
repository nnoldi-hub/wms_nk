const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class BatchSelectionService {
  /**
   * Select optimal batch based on strategy
   * @param {string} productSku - Product SKU
   * @param {number} requiredQuantity - Required quantity
   * @param {string} method - Selection method (FIFO, MIN_WASTE, LOCATION_PROXIMITY)
   * @param {Object} options - Additional options (preferredLocation, etc.)
   * @returns {Promise<Object>} Selected batch with alternatives
   */
  static async selectOptimalBatch(productSku, requiredQuantity, method = 'FIFO', options = {}) {
    try {
      // Get available batches
      const batches = await this.getAvailableBatches(productSku, requiredQuantity);
      
      if (batches.length === 0) {
        throw new AppError('No available batches found for product', 404);
      }

      let selectedBatch;
      
      // Apply selection strategy
      switch (method.toUpperCase()) {
        case 'FIFO':
          selectedBatch = await this.selectByFIFO(batches);
          break;
        case 'MIN_WASTE':
          selectedBatch = await this.selectByMinWaste(batches, requiredQuantity);
          break;
        case 'LOCATION_PROXIMITY':
          selectedBatch = await this.selectByLocationProximity(batches, options.preferredLocation);
          break;
        default:
          selectedBatch = await this.selectByFIFO(batches);
      }

      // Calculate batch info
      const batchInfo = await this.calculateBatchInfo(selectedBatch, requiredQuantity);
      
      // Get alternative batches (top 3 excluding selected)
      const alternatives = batches
        .filter(b => b.id !== selectedBatch.id)
        .slice(0, 3)
        .map(b => this.calculateBatchInfo(b, requiredQuantity));

      return {
        success: true,
        selectedBatch: batchInfo,
        alternatives,
        method
      };
    } catch (error) {
      logger.error('Error selecting batch:', error);
      throw error;
    }
  }

  /**
   * Get available batches for product
   */
  static async getAvailableBatches(productSku, minQuantity = 0) {
    const result = await pool.query(`
      SELECT pb.*, 
             pu.code as unit_code,
             pu.is_splittable,
             l.zone, l.rack, l.position
      FROM product_batches pb
      LEFT JOIN product_units pu ON pb.unit_id = pu.id
      LEFT JOIN locations l ON pb.location_id = l.id
      WHERE pb.product_sku = $1
        AND pb.status IN ('INTACT', 'CUT')
        AND pb.current_quantity >= $2
      ORDER BY pb.received_at ASC
    `, [productSku, minQuantity]);

    return result.rows;
  }

  /**
   * Select by FIFO (First In First Out)
   */
  static async selectByFIFO(batches) {
    // Already sorted by received_at ASC
    return batches[0];
  }

  /**
   * Select by minimum waste
   */
  static async selectByMinWaste(batches, requiredQuantity) {
    let minWaste = Infinity;
    let selectedBatch = batches[0];

    for (const batch of batches) {
      const waste = this.calculateWaste(batch.current_quantity, requiredQuantity);
      
      if (waste === 0) {
        // Perfect match, no waste
        return batch;
      }
      
      if (waste < minWaste) {
        minWaste = waste;
        selectedBatch = batch;
      }
    }

    return selectedBatch;
  }

  /**
   * Select by location proximity
   */
  static async selectByLocationProximity(batches, preferredLocation) {
    if (!preferredLocation) {
      return this.selectByFIFO(batches);
    }

    // Try to find batch in same zone
    const sameLoc = batches.find(b => b.location_id === preferredLocation);
    if (sameLoc) return sameLoc;

    // Get preferred location details
    const locationResult = await pool.query(
      'SELECT zone FROM locations WHERE id = $1',
      [preferredLocation]
    );

    if (locationResult.rows.length === 0) {
      return this.selectByFIFO(batches);
    }

    const preferredZone = locationResult.rows[0].zone;
    
    // Find batch in same zone
    const sameZone = batches.find(b => b.zone === preferredZone);
    if (sameZone) return sameZone;

    // Fallback to FIFO
    return this.selectByFIFO(batches);
  }

  /**
   * Calculate waste amount
   */
  static calculateWaste(availableQuantity, requiredQuantity) {
    return Math.max(0, availableQuantity - requiredQuantity);
  }

  /**
   * Calculate batch info with waste percentage
   */
  static calculateBatchInfo(batch, requiredQuantity) {
    const waste = this.calculateWaste(batch.current_quantity, requiredQuantity);
    const wastePercent = (waste / batch.current_quantity) * 100;

    return {
      ...batch,
      waste_quantity: waste,
      waste_percent: Math.round(wastePercent * 100) / 100,
      location: batch.zone && batch.rack && batch.position
        ? `${batch.zone}-${batch.rack}-${batch.position}`
        : batch.location_id
    };
  }

  /**
   * Validate batch availability
   */
  static async validateBatchAvailability(batchId, requiredQuantity) {
    const result = await pool.query(
      'SELECT * FROM product_batches WHERE id = $1',
      [batchId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Batch not found', 404);
    }

    const batch = result.rows[0];

    if (batch.status === 'EMPTY') {
      throw new AppError('Batch is empty', 400);
    }

    if (batch.current_quantity < requiredQuantity) {
      throw new AppError('Insufficient quantity in batch', 400);
    }

    return batch;
  }

  /**
   * Get active selection rules from database
   */
  static async getActiveRules() {
    const result = await pool.query(`
      SELECT * FROM batch_selection_rules
      WHERE is_active = true
      ORDER BY priority DESC
    `);

    return result.rows;
  }
}

module.exports = BatchSelectionService;
