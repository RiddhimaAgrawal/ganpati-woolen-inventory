const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { hashPassword, passwordProblem } = require('../auth/password');

const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;

// GET /api/users   (admin)
async function listUsers(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, username, name, is_admin, created_at FROM users ORDER BY name');
    res.json(rows.map((u) => ({ ...u, is_admin: !!u.is_admin })));
  } catch (err) {
    sendError(res, err, 'Failed to fetch users');
  }
}

// POST /api/users   (admin)   { username, name, password, is_admin }
async function createUser(req, res) {
  try {
    const username = String((req.body && req.body.username) || '').trim().toLowerCase();
    const name = String((req.body && req.body.name) || '').trim();
    const { password, is_admin } = req.body || {};

    if (!name) return res.status(400).json({ error: 'Please enter the full name.' });
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username: 3 to 50 letters, numbers, dots, dashes or underscores, no spaces.' });
    }
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });

    const [result] = await pool.query(
      'INSERT INTO users (username, name, password_hash, is_admin) VALUES (?, ?, ?, ?)',
      [username, name.slice(0, 100), await hashPassword(password), is_admin ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId, username, name, is_admin: !!is_admin });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    }
    sendError(res, err, 'Failed to add the person');
  }
}

// POST /api/users/:id/reset-password   (admin)   { password }
async function resetPassword(req, res) {
  try {
    const problem = passwordProblem((req.body || {}).password);
    if (problem) return res.status(400).json({ error: problem });
    const [result] = await pool.query(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [await hashPassword(req.body.password), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Person not found.' });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not reset the password');
  }
}

// DELETE /api/users/:id   (admin)
async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });
    const [[target]] = await pool.query('SELECT id, is_admin FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Person not found.' });
    if (target.is_admin) {
      const [[admins]] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1');
      if (admins.n <= 1) return res.status(400).json({ error: 'There must be at least one admin.' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not remove the person');
  }
}

module.exports = { listUsers, createUser, resetPassword, deleteUser };
