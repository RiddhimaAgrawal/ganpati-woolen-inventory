const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const {
  hashPassword,
  checkPassword,
  passwordProblem,
  DUMMY_HASH,
} = require('../auth/password');
const { signToken } = require('../auth/token');
const limiter = require('../auth/rateLimit');

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  is_admin: user.is_admin === true,
});

// POST /api/auth/login
async function login(req, res) {
  try {
    if (limiter.isBlocked(req)) {
      return res.status(429).json({
        error: 'Too many wrong attempts. Please wait 15 minutes and try again.',
        code: 'TOO_MANY',
      });
    }

    const username = String(req.body?.username || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        error: 'Please enter your username and password.',
      });
    }

    const result = await pool.query(
  `SELECT id, username, password_hash, is_admin, token_version
   FROM users
   WHERE LOWER(username) = LOWER($1)
   LIMIT 1`,
  [username]
);

const user = result.rows[0];

if (!user) {
  return res.status(401).json({
    error: 'Wrong username or password'
  });
}

const passwordMatches = await checkPassword(
  password,
  user.password_hash
);

if (!passwordMatches) {
  return res.status(401).json({
    error: 'Wrong username or password'
  });
}

    limiter.clear(req);

    return res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    return sendError(res, err, 'Login failed');
  }
}

// GET /api/auth/me
function me(req, res) {
  return res.json({ user: req.user });
}

// POST /api/auth/change-password
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body || {};

    if (typeof current_password !== 'string') {
      return res.status(400).json({
        error: 'Please enter your current password.',
      });
    }

    const problem = passwordProblem(new_password);

    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    if (
      !user ||
      !(await checkPassword(current_password, user.password_hash))
    ) {
      return res.status(400).json({
        error: 'Your current password is not correct.',
      });
    }

    const updated = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           token_version = token_version + 1
       WHERE id = $2
       RETURNING *`,
      [await hashPassword(new_password), user.id]
    );

    const freshUser = updated.rows[0];

    if (!freshUser) {
      return res.status(404).json({
        error: 'User account was not found.',
      });
    }

    // Return a new token for this device; previous tokens are invalidated.
    return res.json({
      token: signToken(freshUser),
      user: publicUser(freshUser),
    });
  } catch (err) {
    return sendError(res, err, 'Could not change the password');
  }
}

module.exports = { login, me, changePassword };