const { Pool } = require('pg');
const { dbConfig, poolSize } = require('./env');

// On Vercel every request may run in its own short-lived instance,
// so keep the pool tiny to avoid exhausting Supabase connections.
const max = process.env.VERCEL ? 1 : poolSize || 5;

const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Supabase requires TLS.
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = pool;