const client = require('prom-client');
const express = require('express');

// Register default metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code']
});

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationMs);

const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route,
      code: String(res.statusCode)
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, Date.now() - start);
  });
  next();
};

const metricsRouter = express.Router();
metricsRouter.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = { metricsMiddleware, metricsRouter, register };
