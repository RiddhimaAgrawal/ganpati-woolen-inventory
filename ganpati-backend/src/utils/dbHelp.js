
const pool = require('../config/db');

const REQUIRED_TABLES = [
  'customers',
  'payments',
  'raw_imports',
  'processing_batches',
  'sales',
  'users',
];

function dbHint(err) {
  switch (err && err.code) {
    case '28P01':
      return 'PostgreSQL authentication failed. Check the cloud database username and password.';
    case '3D000':
      return 'The PostgreSQL database name is incorrect or the database does not exist.';
    case '42501':
      return 'The database user does not have permission to perform this operation.';
    case '42P01':
      return 'A required table is missing. Check the Supabase public schema.';
    case '42703':
      return 'A required column is missing. Check that the Supabase schema matches the cloud backend code.';
    case '23505':
      return 'A record with the same unique value already exists.';
    case '23503':
      return 'This operation references a record that does not exist or is still in use.';
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case 'EHOSTUNREACH':
      return 'Cannot reach PostgreSQL. Check the Supabase connection URL, network access, and database availability.';
    default:
      return null;
  }
}

function sendError(res, err, fallback) {
  console.error(fallback, {
    code: err && err.code,
    message: err && err.message,
  });

  const hint = dbHint(err);

  return res.status(500).json({
    error: hint ? `${fallback}. ${hint}` : fallback,
    ...(err && err.code ? { code: err.code } : {}),
  });
}

async function diagnose() {
  try {
    await pool.query('SELECT 1');

    const result = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES]
    );

    const found = new Set(result.rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((name) => !found.has(name));

    if (missing.length) {
      return {
        ok: false,
        code: 'MISSING_TABLES',
        message: `Missing Supabase tables: ${missing.join(', ')}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'DATABASE_ERROR',
      message: dbHint(err) || 'Could not connect to or inspect PostgreSQL.',
    };
  }
}

module.exports = { dbHint, sendError, diagnose };
