
const pool = require('../config/db');
const { hashPassword, passwordProblem } = require('./password');

async function ensureAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '')
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const reset =
    String(process.env.ADMIN_RESET_PASSWORD || '').toLowerCase() === 'true';

  if (!username || !password) {
    const result = await pool.query('SELECT COUNT(*) AS n FROM users');
    const count = Number(result.rows[0].n);

    return {
      created: false,
      ...(count === 0
        ? {
            message:
              'No users exist yet. Set ADMIN_USERNAME and ADMIN_PASSWORD in the cloud environment.',
          }
        : {}),
    };
  }

  const problem = passwordProblem(password);
  if (problem) {
    return {
      created: false,
      message: `ADMIN_PASSWORD is not usable: ${problem}`,
    };
  }

  const existing = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  const hash = await hashPassword(password);

  if (existing.rowCount === 0) {
    const countResult = await pool.query('SELECT COUNT(*) AS n FROM users');
    const count = Number(countResult.rows[0].n);

    // Only create the initial admin automatically when the users table is empty.
    if (count !== 0 && !reset) {
      return { created: false };
    }

    if (count === 0 || reset) {
      await pool.query(
        `INSERT INTO users (username, name, password_hash, is_admin)
         VALUES ($1, $2, $3, TRUE)`,
        [username, process.env.ADMIN_NAME || 'Admin', hash]
      );

      return {
        created: true,
        message: `Created admin account "${username}".`,
      };
    }
  }

  if (reset) {
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           is_admin = TRUE,
           token_version = token_version + 1
       WHERE username = $2
       RETURNING id`,
      [hash, username]
    );

    if (result.rowCount === 0) {
      return {
        created: false,
        message: 'Admin reset was requested, but the account was not found.',
      };
    }

    return {
      created: false,
      message: `Password for "${username}" was reset. Remove ADMIN_RESET_PASSWORD from the cloud environment now.`,
    };
  }

  return { created: false };
}

module.exports = { ensureAdmin };
