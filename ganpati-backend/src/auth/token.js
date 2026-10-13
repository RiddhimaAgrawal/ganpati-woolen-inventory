const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let secret = process.env.JWT_SECRET;
let generated = false;
if (!secret || secret.length < 16) {
  // Not set (or too short): make a random one. Everyone must log in again after each restart,
  // so set JWT_SECRET (any long random text) to stay logged in.
  secret = crypto.randomBytes(32).toString('hex');
  generated = true;
}

const EXPIRES_IN = '30d'; // phones stay logged in for a month

function signToken(user) {
  return jwt.sign({ sub: user.id, ver: user.token_version }, secret, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken, secretWasGenerated: generated };
