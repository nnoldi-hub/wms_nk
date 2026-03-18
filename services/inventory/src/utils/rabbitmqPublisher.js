/**
 * rabbitmqPublisher.js — Publisher singleton pentru inventory-service
 *
 * Publică evenimente pe exchange-ul inventory.events.
 * Reconectare automată la erori.
 */
const amqp = require('amqplib');
const logger = require('./logger');

const EXCHANGE = 'inventory.events';
let channel = null;
let connecting = false;

async function connect() {
  if (connecting) return;
  connecting = true;
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    channel = ch;
    connecting = false;
    logger.info('[rabbitmqPublisher] Connected to RabbitMQ');

    conn.on('error', (err) => {
      logger.error('[rabbitmqPublisher] Connection error:', err.message);
      channel = null;
      setTimeout(connect, 5000);
    });
    conn.on('close', () => {
      logger.warn('[rabbitmqPublisher] Connection closed, reconnecting...');
      channel = null;
      connecting = false;
      setTimeout(connect, 5000);
    });
  } catch (err) {
    connecting = false;
    logger.error('[rabbitmqPublisher] Failed to connect:', err.message);
    setTimeout(connect, 5000);
  }
}

/**
 * Publică un eveniment pe inventory.events.
 * @param {string} routingKey   ex: 'pick-job.assigned'
 * @param {object} payload      datele evenimentului
 */
function publish(routingKey, payload) {
  if (!channel) {
    logger.warn(`[rabbitmqPublisher] Channel not ready, skipping event: ${routingKey}`);
    return;
  }
  try {
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    logger.info(`[rabbitmqPublisher] Published: ${routingKey}`);
  } catch (err) {
    logger.error(`[rabbitmqPublisher] Publish error for ${routingKey}:`, err.message);
    channel = null;
    setTimeout(connect, 5000);
  }
}

// Inițializare la import
connect();

module.exports = { publish };
