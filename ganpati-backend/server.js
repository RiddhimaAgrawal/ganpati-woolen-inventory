const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./src/config/env');

const pool = require('./src/config/db');

const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const rawImportsRoutes = require('./src/routes/rawImports.routes');
const processingRoutes = require('./src/routes/processing.routes');
const salesRoutes = require('./src/routes/sales.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const customersRoutes = require('./src/routes/customers.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const exportRoutes = require('./src/routes/export.routes');

const { requireAuth } = require('./src/auth/middleware');
const { verifyToken } = require('./src/auth/token');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Configure an explicit FRONTEND_URL in production.
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests without an Origin header (e.g. server-to-server checks).
    if (!origin || allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
}));

app.use(express.json({ limit: '1mb' }));

const REQUIRED_TABLES = [
  'customers',
  'users',
  'raw_imports',
  'processing_batches',
  'sales',
  'payments',
];

async function checkDatabase() {
  const { configError } = require('./src/config/env');
  if (configError) {
    const e = new Error(configError);
    e.code = 'BAD_CONFIG';
    throw e;
  }
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

  if (missing.length > 0) {
    const error = new Error(
      `Missing Supabase tables: ${missing.join(', ')}`
    );
    error.code = 'MISSING_TABLES';
    throw error;
  }

  return true;
}

function maySeeDetails(req) {
  const local = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
  ].includes(req.socket.remoteAddress) &&
    !req.headers['x-forwarded-for'];

  if (local) return true;

  const match = /^Bearer (.+)$/.exec(
    req.headers.authorization || ''
  );

  if (!match) return false;

  try {
    verifyToken(match[1]);
    return true;
  } catch (_) {
    return false;
  }
}

// Friendly root page (the backend only serves /api/* routes)
app.get('/', (req, res) => {
  const { configError } = require('./src/config/env');
  res.json({
    name: 'Ganpati Woolen API',
    status: 'running',
    health: '/api/health',
    ...(configError ? { configError } : {}),
  });
});

// Public health endpoint
app.get('/api/health', async (req, res) => {
  try {
    await checkDatabase();

    return res.status(200).json({
      server: 'running',
      database: 'connected, all required tables found',
    });
  } catch (err) {
    console.error('Database health check failed:', err.message);

    const details = maySeeDetails(req);

    return res.status(500).json({
      server: 'running',
      database: 'PROBLEM',
      ...(details ? {
        problem: err.message,
        code: err.code || 'DATABASE_ERROR',
      } : {}),
    });
  }
});

// Authentication routes
app.use('/api/auth', authRoutes);

// All following API routes require authentication.
app.use('/api', requireAuth);

app.use('/api/users', usersRoutes);
app.use('/api/raw-imports', rawImportsRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Optional frontend serving for combined deployments.
const distDir = path.join(__dirname, '..', 'ganpati-frontend', 'dist');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Request error:', err.message);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(
    err.message === 'Origin not allowed by CORS' ? 403 : 500
  ).json({
    error: err.message === 'Origin not allowed by CORS'
      ? 'Origin not allowed'
      : 'Something went wrong',
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Cloud backend listening on port ${PORT}`);

  try {
    await checkDatabase();
    console.log('Supabase PostgreSQL connection and required tables verified.');
  } catch (err) {
    console.error('Supabase check failed:', err.message);
  }
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;