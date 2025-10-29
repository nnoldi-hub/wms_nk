const amqp = require('amqplib');
const logger = require('./utils/logger');

async function setupRabbitMQ(io) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    const exchanges = [
      'scanner.events',
      'cutting.events',
      'sewing.events',
      'qc.events',
      'shipments.events',
      'inventory.events'
    ];

    for (const exchange of exchanges) {
      await channel.assertExchange(exchange, 'topic', { durable: true });
      const { queue } = await channel.assertQueue('', { exclusive: true });
      await channel.bindQueue(queue, exchange, '#');

      channel.consume(queue, (msg) => {
        if (msg) {
          const event = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          
          logger.info(`Event received: ${exchange} -> ${routingKey}`);

          const notification = {
            type: routingKey,
            source: exchange.split('.')[0],
            data: event,
            timestamp: new Date().toISOString()
          };

          io.to(`role:${event.targetRole || 'all'}`).emit('notification', notification);
          
          if (event.userId) {
            io.to(`user:${event.userId}`).emit('notification', notification);
          }

          channel.ack(msg);
        }
      }, { noAck: false });
    }

    logger.info('RabbitMQ consumer ready for all exchanges');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed, reconnecting...');
      setTimeout(() => setupRabbitMQ(io), 5000);
    });

  } catch (error) {
    logger.error('Failed to setup RabbitMQ:', error);
    setTimeout(() => setupRabbitMQ(io), 5000);
  }
}

module.exports = setupRabbitMQ;
