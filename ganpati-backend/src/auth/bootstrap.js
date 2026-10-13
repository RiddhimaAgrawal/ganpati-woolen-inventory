const pool = require('../config/db');
const { hashPassword, passwordProblem } = require('./password');

// If there are no users yet and ADMIN_USERNAME / ADMIN_PASSWORD are set, create the first admin.
// To recover a forgotten admin password on a host without a command line:
// set ADMIN_RESET_PASSWORD=true (with ADMIN_USERNAME and ADMIN_PASSWORD), restart, then remove it.
async function ensureAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const [[count]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  const reset = String(process.env.ADMIN_RESET_PASSWORD).toLowerCase() === 'true';

  if (!username || !password) {
    if (count.n === 0) {
      return { created: false, message: 'No one can log in yet. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env (then restart), or run: npm run create-user' };
    }
    return { created: false };
  }
  const problem = passwordProblem(password);
  if (problem) return { created: false, message: `ADMIN_PASSWORD is not usable: ${problem}` };

  if (count.n === 0) {
    await pool.query('INSERT INTO users (username, name, password_hash, is_admin) VALUES (?, ?, ?, 1)', [
      username,
      process.env.ADMIN_NAME || 'Admin',
      await hashPassword(password)
    ]);
    return { created: true, message: `Created the first admin account "${username}".` };
  }
  if (reset) {
    const hash = await hashPassword(password);
    const [r] = await pool.query(
      'UPDATE users SET password_hash = ?, is_admin = 1, token_version = token_version + 1 WHERE username = ?',
      [hash, username]
    );
    if (!r.affectedRows) {
      await pool.query('INSERT INTO users (username, name, password_hash, is_admin) VALUES (?, ?, ?, 1)', [
        username, process.env.ADMIN_NAME || 'Admin', hash
      ]);
    }
    return { created: false, message: `Password for "${username}" was reset (ADMIN_RESET_PASSWORD is on - remove it now).` };
  }
  return { created: false };
}

module.exports = { ensureAdmin };
