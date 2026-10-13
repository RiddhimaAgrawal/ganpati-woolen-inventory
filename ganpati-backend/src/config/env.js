
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env'),
});

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  throw new Error(
    'Missing PostgreSQL connection string. Set POSTGRES_URL in the cloud backend environment.'
  );
}

let parsedUrl;

try {
  parsedUrl = new URL(POSTGRES_URL);

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('The connection URL must use PostgreSQL.');
  }
} catch (err) {
  throw new Error(`Invalid PostgreSQL connection URL: ${err.message}`);
}

const poolSize = Number(process.env.DB_POOL_SIZE) || 5;

// Retain useful connection metadata for any remaining shared utilities.
const dbConfig = {
  connectionString: POSTGRES_URL,
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port) || 5432,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')),
  ssl: { rejectUnauthorized: false },
};

module.exports = {
  POSTGRES_URL,
  poolSize,
  dbConfig,
  EXAMPLE_PASSWORD: '',
};
