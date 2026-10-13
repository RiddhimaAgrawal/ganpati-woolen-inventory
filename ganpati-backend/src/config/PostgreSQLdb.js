
const { Pool } = require('pg');

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is missing from environment variables.');
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err.message);
});

module.exports = pool;
