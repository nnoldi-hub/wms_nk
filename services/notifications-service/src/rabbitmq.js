const amqp = require('amqplib');
const logger = require('./utils/logger');

// Hartă routing key → emitter specific
const ROUTING_HANDLERS = {
  'pick-job.assigned': (io, event) => {
    const { jobId, operatorId, priority = 'NORMAL', orderRef, itemsCount, assignedBy } = event;
    logger.info(`Job ${jobId} assigned to operator ${operatorId} (priority: ${priority})`);

    // Emit dedicated event on operator's personal room
    io.to(`user:${operatorId}`).emit('job:assigned', {
      jobId,
      priority,
      orderRef,
      itemsCount,
      assignedBy,
    });

    // Also emit generic notification for any dashboard listeners
    io.to(`role:manager`).emit('notification', {
      type: 'pick-job.assigned',
      source: 'inventory',
      data: event,
      timestamp: new Date().toISOString(),
    });
  },

  'pick-job.sla-breach': (io, event) => {
    const { jobId, operatorId, operatorUsername, priority } = event;
    logger.warn(`SLA breach pentru job ${jobId} (operator: ${operatorUsername || operatorId})`);
    io.to('role:manager').emit('job:sla-breach', {
      jobId,
      operatorId,
      operatorUsername,
      priority,
      message: `Jobul ${jobId} nu a fost acceptat în timp — operator: ${operatorUsername || operatorId}`,
    });
  },

  'pick-job.requeued': (io, event) => {
    const { jobId, previousOperatorId } = event;
    logger.warn(`Job ${jobId} re-introdus în coadă (operator anterior: ${previousOperatorId})`);
    io.to('role:manager').emit('job:requeued', {
      jobId,
      previousOperatorId,
      message: `Jobul ${jobId} a fost re-introdus în coadă (operator nu a răspuns în 10 min)`,
    });
  },
};

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

          // Dacă există un handler specific, îl folosim
          const handler = ROUTING_HANDLERS[routingKey];
          if (handler) {
            handler(io, event);
          } else {
            // Fallback generic: broadcast la rol
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
