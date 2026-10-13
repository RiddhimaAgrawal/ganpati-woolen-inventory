const pool = require('../config/db');
const { verifyToken } = require('./token');
const { sendError } = require('../utils/dbHelp');

// Every request to the API (except login and health) must carry a valid login token.
async function requireAuth(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Please log in.', code: 'AUTH_REQUIRED' });

  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (e) {
    return res.status(401).json({ error: 'Your login has expired. Please log in again.', code: 'AUTH_EXPIRED' });
  }

  try {
    // Look the person up every time, so removing someone or changing a password takes effect at once.
    const [rows] = await pool.query(
      'SELECT id, username, name, is_admin, token_version FROM users WHERE id = ?',
      [payload.sub]
    );
    const user = rows[0];
    if (!user || user.token_version !== payload.ver) {
      return res.status(401).json({ error: 'Your login is no longer valid. Please log in again.', code: 'AUTH_EXPIRED' });
    }
    req.user = { id: user.id, username: user.username, name: user.name, is_admin: !!user.is_admin };
    next();
  } catch (err) {
    sendError(res, err, 'Could not check your login');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Only an admin can do this.', code: 'FORBIDDEN' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
