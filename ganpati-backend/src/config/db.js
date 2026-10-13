
const { Pool } = require('pg');
const { POSTGRES_URL, poolSize } = require('./env');

const pool = new Pool({
  connectionString: POSTGRES_URL,
  max: poolSize || 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,

  // Supabase PostgreSQL connections use TLS.
  // Prefer certificate verification when your connection setup supports it.
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = pool;
