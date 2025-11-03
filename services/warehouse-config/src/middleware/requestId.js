const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && incoming.trim()) ? incoming.trim() : uuidv4();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  res.locals.requestId = id;
  next();
}

module.exports = requestIdMiddleware;
