// Simple pagination helper to keep list endpoints consistent
// Usage: const { limit, offset, sortBy, sortDir, page } = parsePagination(req.query, ['created_at']);

function parsePositiveInt(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parsePagination(query, allowedSort = ['created_at'], defaultSort = 'created_at', options = {}) {
  const maxLimit = options.maxLimit || 100;
  const page = parsePositiveInt(query.page, 1);
  let limit = parsePositiveInt(query.limit, 25);
  if (limit > maxLimit) limit = maxLimit;
  const offset = (page - 1) * limit;

  const requestedSort = (query.sortBy || defaultSort).toString();
  const sortBy = allowedSort.includes(requestedSort) ? requestedSort : defaultSort;
  const sortDir = (query.sortDir || 'asc').toString().toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  return { page, limit, offset, sortBy, sortDir };
}

module.exports = { parsePagination };
