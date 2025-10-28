const scanService = require('../services/scanService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class ScanController {
  async processScan(req, res, next) {
    try {
      const scanData = req.validatedData;
      logger.info('Processing scan:', scanData);

      const result = await scanService.processScan(scanData);

      res.status(200).json({
        success: true,
        message: 'Scan processed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async validateCode(req, res, next) {
    try {
      const { code } = req.params;

      if (!code) {
        throw new AppError('Code parameter is required', 400);
      }

      const validation = await scanService.validateCode(code);

      res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }

  async getScanHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!userId) {
        throw new AppError('UserId parameter is required', 400);
      }

      const history = await scanService.getScanHistory(
        parseInt(userId),
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { period = 'day' } = req.query;
      const stats = await scanService.getStats(period);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ScanController();
