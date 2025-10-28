const amqp = require('amqplib');
const logger = require('../utils/logger');

class RabbitMQConnection {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672'
      );

      this.channel = await this.connection.createChannel();

      // Declare exchanges and queues
      await this.channel.assertExchange('scanner.events', 'topic', { durable: true });
      await this.channel.assertQueue('scanner.scans', { durable: true });
      await this.channel.assertQueue('scanner.validations', { durable: true });

      logger.info('RabbitMQ connected and queues declared');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publishScanEvent(scanData) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    try {
      const message = JSON.stringify({
        ...scanData,
        timestamp: new Date().toISOString(),
      });

      await this.channel.publish(
        'scanner.events',
        'scan.completed',
        Buffer.from(message),
        { persistent: true }
      );

      logger.info('Scan event published:', scanData.code);
    } catch (error) {
      logger.error('Failed to publish scan event:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
    }
  }
}

module.exports = new RabbitMQConnection();
