const path = require('path');

// Local development only: load ganpati-backend/.env if it exists.
// On Vercel the variables come from Project Settings, so never crash here.
try {
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '.env'),
  });
} catch (_) {
  /* ignore */
}

const POSTGRES_URL = (
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  ''
).trim();

// Parse manually so a password containing @ # / ? etc. cannot break it.
// The password is everything between the first ":" after the user and the LAST "@".
function parseUrl(url) {
  const m = /^postgres(?:ql)?:\/\/([^:/@]+):(.*)@([^@/:?]+)(?::(\d+))?\/([^?]*)/.exec(url);
  if (!m) return null;
  const dec = (v) => {
    try { return decodeURIComponent(v); } catch (_) { return v; }
  };
  return {
    user: dec(m[1]),
    password: dec(m[2]),
    host: m[3],
    port: Number(m[4]) || 5432,
    database: dec(m[5]) || 'postgres',
  };
}

const parsed = POSTGRES_URL ? parseUrl(POSTGRES_URL) : null;

let configError = null;
if (!POSTGRES_URL) {
  configError = 'POSTGRES_URL is not set in the environment variables.';
} else if (!parsed) {
  configError =
    'POSTGRES_URL is not a valid PostgreSQL URL. Expected postgresql://USER:PASSWORD@HOST:PORT/postgres (no [ ] brackets around the password).';
}

if (configError) console.error('CONFIG PROBLEM:', configError);

const poolSize = Number(process.env.DB_POOL_SIZE) || 5;

const dbConfig = {
  host: parsed ? parsed.host : 'invalid-config.local',
  port: parsed ? parsed.port : 5432,
  user: parsed ? parsed.user : '',
  password: parsed ? parsed.password : '',
  database: parsed ? parsed.database : 'postgres',
  ssl: { rejectUnauthorized: false },
};

module.exports = { POSTGRES_URL, poolSize, dbConfig, configError, EXAMPLE_PASSWORD: '' };