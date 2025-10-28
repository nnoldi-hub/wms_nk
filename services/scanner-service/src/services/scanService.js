const axios = require('axios');
const redisClient = require('../config/redis');
const rabbitmq = require('../config/rabbitmq');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3011';
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300;
const SCAN_HISTORY_TTL = parseInt(process.env.SCAN_HISTORY_TTL) || 3600;

class ScanService {
  /**
   * Process a barcode/QR scan
   */
  async processScan(scanData) {
    const { code, type, userId, metadata } = scanData;

    try {
      // Check cache first
      const cacheKey = `scan:${code}`;
      const cachedResult = await redisClient.get(cacheKey);

      if (cachedResult) {
        logger.info(`Cache hit for code: ${code}`);
        const result = JSON.parse(cachedResult);
        
        // Still record the scan event
        await this.recordScanEvent(code, type, userId, result, metadata);
        
        return result;
      }

      // Validate and identify the code
      const validation = await this.validateCode(code);

      if (!validation.isValid) {
        throw new AppError('Invalid code format', 400);
      }

      // Fetch entity details based on type
      let entityData = null;
      if (validation.entityType === 'product') {
        entityData = await this.fetchProductDetails(code);
      } else if (validation.entityType === 'location') {
        entityData = await this.fetchLocationDetails(code);
      }

      const result = {
        code,
        scanType: type,
        entityType: validation.entityType,
        entity: entityData,
        timestamp: new Date().toISOString(),
      };

      // Cache the result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));

      // Record scan event
      await this.recordScanEvent(code, type, userId, result, metadata);

      // Publish event to RabbitMQ
      await rabbitmq.publishScanEvent({
        code,
        type,
        userId,
        entityType: validation.entityType,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      logger.error('Error processing scan:', error);
      throw error;
    }
  }

  /**
   * Validate a code format and determine entity type
   */
  async validateCode(code) {
    const validation = {
      isValid: false,
      entityType: null,
      format: null,
    };

    // Check if it's a product SKU (starts with letters, alphanumeric)
    if (/^[A-Z]{2,3}-\d{4,6}$/i.test(code)) {
      validation.isValid = true;
      validation.entityType = 'product';
      validation.format = 'SKU';
      return validation;
    }

    // Check if it's a location ID (e.g., A-01-001)
    if (/^[A-Z]-\d{2}-\d{3}$/i.test(code)) {
      validation.isValid = true;
      validation.entityType = 'location';
      validation.format = 'LOCATION_ID';
      return validation;
    }

    // Check if it's an EAN13 (13 digits)
    if (/^\d{13}$/.test(code)) {
      validation.isValid = true;
      validation.entityType = 'product';
      validation.format = 'EAN13';
      return validation;
    }

    // Check if it's a UPC-A (12 digits)
    if (/^\d{12}$/.test(code)) {
      validation.isValid = true;
      validation.entityType = 'product';
      validation.format = 'UPC_A';
      return validation;
    }

    // Generic alphanumeric code
    if (/^[A-Z0-9-]{4,50}$/i.test(code)) {
      validation.isValid = true;
      validation.entityType = 'unknown';
      validation.format = 'GENERIC';
      return validation;
    }

    return validation;
  }

  /**
   * Fetch product details from Inventory Service
   */
  async fetchProductDetails(sku) {
    try {
      const response = await axios.get(
        `${INVENTORY_SERVICE_URL}/api/v1/products/${sku}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      throw new AppError('Product not found', 404);
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppError('Product not found', 404);
      }
      logger.error('Error fetching product details:', error);
      throw new AppError('Failed to fetch product details', 500);
    }
  }

  /**
   * Fetch location details from Inventory Service
   */
  async fetchLocationDetails(locationId) {
    try {
      const response = await axios.get(
        `${INVENTORY_SERVICE_URL}/api/v1/locations/${locationId}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      throw new AppError('Location not found', 404);
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppError('Location not found', 404);
      }
      logger.error('Error fetching location details:', error);
      throw new AppError('Failed to fetch location details', 500);
    }
  }

  /**
   * Record scan event in Redis for history
   */
  async recordScanEvent(code, type, userId, result, metadata) {
    try {
      const scanEvent = {
        code,
        type,
        userId,
        entityType: result.entityType,
        timestamp: new Date().toISOString(),
        metadata,
      };

      // Store in user's scan history (Redis sorted set)
      if (userId) {
        const historyKey = `scan_history:${userId}`;
        const score = Date.now();
        await redisClient.zAdd(historyKey, {
          score,
          value: JSON.stringify(scanEvent),
        });

        // Set expiry on the sorted set
        await redisClient.expire(historyKey, SCAN_HISTORY_TTL);
      }

      // Increment scan counters
      const dateKey = new Date().toISOString().split('T')[0];
      await redisClient.incr(`scan_count:${dateKey}`);
      await redisClient.incr(`scan_count:${dateKey}:${result.entityType}`);

      logger.info('Scan event recorded:', scanEvent);
    } catch (error) {
      logger.error('Error recording scan event:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Get scan history for a user
   */
  async getScanHistory(userId, limit = 50, offset = 0) {
    try {
      const historyKey = `scan_history:${userId}`;
      
      // Get scans from Redis sorted set (newest first)
      const scans = await redisClient.zRange(historyKey, offset, offset + limit - 1, {
        REV: true,
      });

      const history = scans.map(scan => JSON.parse(scan));

      return {
        userId,
        scans: history,
        count: history.length,
      };
    } catch (error) {
      logger.error('Error fetching scan history:', error);
      throw new AppError('Failed to fetch scan history', 500);
    }
  }

  /**
   * Get scanning statistics
   */
  async getStats(period = 'day') {
    try {
      const stats = {
        period,
        totalScans: 0,
        scansByType: {},
        timestamp: new Date().toISOString(),
      };

      const dateKey = new Date().toISOString().split('T')[0];

      // Get total scans
      const totalScans = await redisClient.get(`scan_count:${dateKey}`);
      stats.totalScans = parseInt(totalScans) || 0;

      // Get scans by entity type
      const productScans = await redisClient.get(`scan_count:${dateKey}:product`);
      const locationScans = await redisClient.get(`scan_count:${dateKey}:location`);
      const unknownScans = await redisClient.get(`scan_count:${dateKey}:unknown`);

      stats.scansByType = {
        product: parseInt(productScans) || 0,
        location: parseInt(locationScans) || 0,
        unknown: parseInt(unknownScans) || 0,
      };

      return stats;
    } catch (error) {
      logger.error('Error fetching stats:', error);
      throw new AppError('Failed to fetch statistics', 500);
    }
  }
}

module.exports = new ScanService();
