const pool = require('../config/db');
const { verifyToken } = require('./token');
const { sendError } = require('../utils/dbHelp');

async function requireAuth(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');

  if (!match) {
    return res.status(401).json({
      error: 'Please log in.',
      code: 'AUTH_REQUIRED',
    });
  }

  let payload;

  try {
    payload = verifyToken(match[1]);
  } catch (_) {
    return res.status(401).json({
      error: 'Your login has expired. Please log in again.',
      code: 'AUTH_EXPIRED',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, name, is_admin, token_version
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    const user = result.rows[0];

    if (
      !user ||
      String(user.token_version) !== String(payload.ver)
    ) {
      return res.status(401).json({
        error: 'Your login is no longer valid. Please log in again.',
        code: 'AUTH_EXPIRED',
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      is_admin: user.is_admin === true,
    };

    return next();
  } catch (err) {
    return sendError(res, err, 'Could not check your login');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      error: 'Only an admin can do this.',
      code: 'FORBIDDEN',
    });
  }

  return next();
}

module.exports = { requireAuth, requireAdmin };
