const pool = require('../config/db');
const { EXAMPLE_PASSWORD } = require('../config/env');

// Turns scary MySQL error codes into plain-English advice.
function dbHint(err) {
  switch (err && err.code) {
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
      if (process.env.DB_PASSWORD === EXAMPLE_PASSWORD) {
        return 'The password in the .env file is still the example text (your_mysql_password). Open ganpati-backend/.env, replace it with your real MySQL password, save, and restart the server.';
      }
      return 'Cannot log in to MySQL. Check DB_USER and DB_PASSWORD in the .env file (and that the .env file exists inside the ganpati-backend folder).';
    case 'ER_DBACCESS_DENIED_ERROR':
      return 'The MySQL user in .env is not allowed to use this database (or DB_NAME in .env is spelled wrongly).';
    case 'ER_BAD_DB_ERROR':
      return 'The database does not exist yet. Run schema.sql in MySQL first (mysql -u root -p < schema.sql), and check DB_NAME in .env.';
    case 'ER_NO_SUCH_TABLE':
      return 'A database table is missing. Run schema.sql in MySQL again to create all tables.';
    case 'ER_SECURE_TRANSPORT_REQUIRED':
      return 'This database only accepts encrypted connections. Add ?ssl-mode=REQUIRED to the end of DATABASE_URL, or set DB_SSL=true.';
    case 'BAD_DB_NAME':
      return 'DB_NAME in the .env file may only contain letters, numbers and underscores.';
    case 'ER_BAD_FIELD_ERROR':
      return 'The database tables do not match this version of the app. Stop the server (Ctrl+C) and start it again with npm start; it repairs the tables automatically and keeps a backup of anything it replaces. Read the messages it prints.';
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case 'EHOSTUNREACH':
    case 'PROTOCOL_CONNECTION_LOST':
      return 'Cannot reach MySQL. Make sure MySQL is running, and check DB_HOST and DB_PORT in .env.';
    default:
      return null;
  }
}

// Logs the real error in the terminal and sends a helpful message to the screen.
function sendError(res, err, fallback) {
  console.error(err);
  const hint = dbHint(err);
  const message = hint
    ? `${fallback}. ${hint}`
    : err && err.code
      ? `${fallback} (technical code: ${err.code})`
      : fallback;
  res.status(500).json({ error: message, code: err && err.code });
}

const REQUIRED_TABLES = ['customers', 'raw_imports', 'processing_batches', 'sales', 'users'];

// Checks the database connection and that every table exists.
async function diagnose() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    return { ok: false, code: err.code, message: dbHint(err) || err.message };
  }
  try {
    const [rows] = await pool.query('SHOW TABLES');
    const have = rows.map((r) => String(Object.values(r)[0]).toLowerCase());
    const missing = REQUIRED_TABLES.filter((t) => !have.includes(t));
    if (missing.length) {
      return {
        ok: false,
        code: 'ER_NO_SUCH_TABLE',
        message: `These tables are missing: ${missing.join(', ')}. Run schema.sql in MySQL again.`
      };
    }
  } catch (err) {
    return { ok: false, code: err.code, message: dbHint(err) || err.message };
  }
  return { ok: true };
}

module.exports = { dbHint, sendError, diagnose };
