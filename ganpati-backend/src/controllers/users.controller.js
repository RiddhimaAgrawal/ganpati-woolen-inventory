
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { hashPassword, passwordProblem } = require('../auth/password');

const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;

// GET /api/users (admin)
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, username, name, is_admin, created_at
       FROM users
       ORDER BY name`
    );

    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to fetch users');
  }
}

// POST /api/users (admin)
async function createUser(req, res) {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const { password, is_admin } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Please enter the full name.' });
    }

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: 'Username: 3 to 50 letters, numbers, dots, dashes or underscores, no spaces.',
      });
    }

    const problem = passwordProblem(password);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const adminFlag = is_admin === true || is_admin === 1 ||
      is_admin === 'true' || is_admin === '1';

    const result = await pool.query(
      `INSERT INTO users (username, name, password_hash, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, name, is_admin, created_at`,
      [
        username,
        name.slice(0, 100),
        await hashPassword(password),
        adminFlag,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({
        error: 'That username is already taken. Please choose another.',
      });
    }

    return sendError(res, err, 'Failed to add the person');
  }
}

// POST /api/users/:id/reset-password (admin)
async function resetPassword(req, res) {
  try {
    const problem = passwordProblem((req.body || {}).password);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           token_version = token_version + 1
       WHERE id = $2
       RETURNING id`,
      [await hashPassword(req.body.password), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return sendError(res, err, 'Could not reset the password');
  }
}

// DELETE /api/users/:id (admin)
async function deleteUser(req, res) {
  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    const id = Number(req.params.id);
    const currentUserId = Number(req.user?.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    if (id === currentUserId) {
      return res.status(400).json({
        error: 'You cannot remove your own account.',
      });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    // Serialize admin deletions so concurrent requests cannot remove
    // the final administrator.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['user-admin-delete']
    );

    const targetResult = await client.query(
      'SELECT id, is_admin FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Person not found.' });
    }

    if (targetResult.rows[0].is_admin) {
      const adminsResult = await client.query(
        'SELECT COUNT(*) AS count FROM users WHERE is_admin = TRUE'
      );

      if (Number(adminsResult.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(400).json({
          error: 'There must be at least one admin.',
        });
      }
    }

    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({ ok: true });
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }

    return sendError(res, err, 'Could not remove the person');
  } finally {
    client.release();
  }
}

module.exports = {
  listUsers,
  createUser,
  resetPassword,
  deleteUser,
};
