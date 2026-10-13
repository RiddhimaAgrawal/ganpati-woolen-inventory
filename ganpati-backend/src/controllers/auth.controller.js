const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { hashPassword, checkPassword, passwordProblem, DUMMY_HASH } = require('../auth/password');
const { signToken } = require('../auth/token');
const limiter = require('../auth/rateLimit');

const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, is_admin: !!u.is_admin });

// POST /api/auth/login   { username, password }
async function login(req, res) {
  try {
    if (limiter.isBlocked(req)) {
      return res.status(429).json({ error: 'Too many wrong attempts. Please wait 15 minutes and try again.', code: 'TOO_MANY' });
    }
    const username = String((req.body && req.body.username) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Please enter your username and password.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    // Always run one bcrypt comparison so a missing user is not faster than a wrong password.
    const ok = await checkPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      limiter.recordFailure(req);
      return res.status(401).json({ error: 'Wrong username or password.', code: 'BAD_LOGIN' });
    }

    limiter.clear(req);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    sendError(res, err, 'Login failed');
  }
}

// GET /api/auth/me
function me(req, res) {
  res.json({ user: req.user });
}

// POST /api/auth/change-password   { current_password, new_password }
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body || {};
    const problem = passwordProblem(new_password);
    if (problem) return res.status(400).json({ error: problem });

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || !(await checkPassword(current_password || '', user.password_hash))) {
      return res.status(400).json({ error: 'Your current password is not correct.' });
    }

    // Raising token_version logs this person out on every other device.
    await pool.query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [
      await hashPassword(new_password),
      user.id
    ]);
    const [fresh] = await pool.query('SELECT * FROM users WHERE id = ?', [user.id]);
    res.json({ token: signToken(fresh[0]), user: publicUser(fresh[0]) });
  } catch (err) {
    sendError(res, err, 'Could not change the password');
  }
}

module.exports = { login, me, changePassword };
