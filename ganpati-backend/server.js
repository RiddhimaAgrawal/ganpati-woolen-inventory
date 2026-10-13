const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { dbConfig } = require('./src/config/env'); // loads .env

const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const rawImportsRoutes = require('./src/routes/rawImports.routes');
const processingRoutes = require('./src/routes/processing.routes');
const salesRoutes = require('./src/routes/sales.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const customersRoutes = require('./src/routes/customers.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const { requireAuth } = require('./src/auth/middleware');
const { verifyToken, secretWasGenerated } = require('./src/auth/token');
const { ensureAdmin } = require('./src/auth/bootstrap');
const { diagnose, dbHint } = require('./src/utils/dbHelp');
const { initDatabase } = require('./src/config/initDb');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind a hosting provider's proxy (Render, Railway...) req.ip is the real visitor
app.use(cors());
app.use(express.json());

// ---------- public routes ----------

// Health check. Anyone may ask "is it running?". The technical reason for a problem is only shown
// to someone logged in, or to a request coming from the same computer.
function maySeeDetails(req) {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.headers['x-forwarded-for'];
  if (local) return true;
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  try { verifyToken(m[1]); return true; } catch (e) { return false; }
}

app.get('/api/health', async (req, res) => {
  const db = await diagnose();
  const details = maySeeDetails(req);
  res.status(db.ok ? 200 : 500).json({
    server: 'running',
    database: db.ok ? 'connected, all tables found' : 'PROBLEM',
    problem: db.ok || !details ? undefined : db.message,
    code: db.ok || !details ? undefined : db.code
  });
});

app.use('/api/auth', authRoutes); // login is public; the other auth routes check the login themselves

// ---------- everything below needs a login ----------
app.use('/api', requireAuth);
app.use('/api/users', usersRoutes); // admin only (checked inside)
app.use('/api/raw-imports', rawImportsRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app (run `npm run build` inside ../ganpati-frontend first).
// This lets the whole system run from one address, e.g. http://localhost:5000
const distDir = path.join(__dirname, '..', 'ganpati-frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Basic error handler for anything that slips through
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;

async function prepareDatabase() {
  if (!dbConfig.user || !dbConfig.database) {
    console.log('\n⚠️  No database settings found.');
    console.log('   Create a file named .env inside the ganpati-backend folder (copy .env.example to .env),');
    console.log('   fill in DB_USER, DB_PASSWORD and DB_NAME (or DATABASE_URL), then restart.\n');
    return;
  }
  try {
    const report = await initDatabase();
    for (const col of report.addedColumns) console.log(`   + added column ${col}`);
    if (report.archived.length) {
      console.log('\n⚠️  Some tables in your database were made for a different design than this app.');
      console.log('   NOTHING WAS DELETED. They were renamed as a backup, and correct new tables were created:');
      for (const a of report.archived) {
        const why = [
          a.missing.length ? `missing columns: ${a.missing.join(', ')}` : '',
          a.mustFill.length ? `extra required columns: ${a.mustFill.join(', ')}` : ''
        ].filter(Boolean).join('; ');
        console.log(`   - ${a.table}  ->  ${a.backup}   (${why})`);
      }
      console.log('');
    }
    const check = await diagnose();
    if (!check.ok) throw Object.assign(new Error(check.message), { code: check.code });
    console.log('✅ Database ready: connected, and all tables are in place.');

    const admin = await ensureAdmin();
    if (admin.message) console.log(`${admin.created ? '👤' : '⚠️ '} ${admin.message}`);
    if (secretWasGenerated) {
      console.log('⚠️  JWT_SECRET is not set, so everyone will have to log in again whenever the server restarts.');
      console.log('   Set JWT_SECRET to any long random text to stay logged in.');
    }
  } catch (err) {
    console.log('\n❌ DATABASE PROBLEM: ' + (dbHint(err) || err.message));
    console.log('   (technical code: ' + (err.code || 'n/a') + ')');
    console.log('   Fix this, then stop (Ctrl+C) and start the server again.\n');
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  prepareDatabase();
});
