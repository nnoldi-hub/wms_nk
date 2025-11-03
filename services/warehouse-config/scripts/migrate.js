require('dotenv').config();
const migrate = require('node-pg-migrate').default;
const path = require('path');

function makeDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_NAME || 'wms';
  const user = process.env.DB_USER || 'postgres';
  const pass = process.env.DB_PASSWORD || 'postgres';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
}

(async () => {
  try {
    await migrate({
      databaseUrl: makeDbUrl(),
      dir: path.join(__dirname, '..', 'src', 'db', 'migrations'),
      direction: 'up',
      timestamp: true,
      migrationsTable: 'pgmigrations',
      verbose: true,
      count: Infinity,
      logger: console,
      singleTransaction: true,
    });
    console.log('Migrations completed');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
