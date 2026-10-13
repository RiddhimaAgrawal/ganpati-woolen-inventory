// Loads ganpati-backend/.env (no matter which folder you start the server from)
// and exposes the database + login settings in one place.
//
// Database settings can be given in any of these ways (first one found wins):
//   1. DATABASE_URL  (or MYSQL_URL)   e.g.  mysql://user:password@host:3306/dbname?ssl-mode=REQUIRED
//   2. DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
//   3. MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE   (set automatically by Railway)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const EXAMPLE_PASSWORD = 'your_mysql_password';
const env = process.env;

function fromUrl(urlText) {
  try {
    const u = new URL(urlText);
    const mode = (u.searchParams.get('ssl-mode') || u.searchParams.get('ssl') || '').toLowerCase();
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      ssl: ['required', 'verify_ca', 'verify_identity', 'true', '1'].includes(mode)
    };
  } catch (e) {
    return null;
  }
}

const urlSettings = fromUrl(env.DATABASE_URL || env.MYSQL_URL || '');

const raw = urlSettings || {
  host: (env.DB_HOST || env.MYSQLHOST || 'localhost').trim(),
  port: Number(env.DB_PORT || env.MYSQLPORT) || 3306,
  user: env.DB_USER || env.MYSQLUSER,
  password: env.DB_PASSWORD !== undefined ? env.DB_PASSWORD : env.MYSQLPASSWORD,
  database: (env.DB_NAME || env.MYSQLDATABASE || '').trim(),
  ssl: false
};

// Managed cloud databases (Aiven, etc.) require an encrypted connection.
const wantSsl = raw.ssl || String(env.DB_SSL).toLowerCase() === 'true';
let ssl;
if (wantSsl) {
  // With DB_SSL_CA (the provider's certificate text) the server identity is verified.
  // Without it the connection is still encrypted, which is fine for a small private app.
  ssl = env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: false };
}

const dbConfig = {
  // On newer Node versions "localhost" can resolve to IPv6 (::1) and fail to reach MySQL.
  // 127.0.0.1 always works, so use it whenever "localhost" is written.
  host: raw.host === 'localhost' ? '127.0.0.1' : raw.host,
  port: raw.port,
  user: raw.user,
  password: raw.password,
  database: raw.database,
  ...(ssl ? { ssl } : {})
};

const poolSize = Number(env.DB_POOL_SIZE) || 5;

module.exports = { dbConfig, EXAMPLE_PASSWORD, poolSize };
