require('dotenv').config();

module.exports = {
  migrationsTable: 'pgmigrations',
  direction: 'up',
  dir: 'src/db/migrations',
  count: Infinity,
  timestamp: true,
  databaseUrl: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'wms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: false,
  },
};
