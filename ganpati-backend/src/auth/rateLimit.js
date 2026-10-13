// Tiny in-memory limiter for failed logins: stops someone from guessing passwords.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map(); // key -> { count, since }

function key(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isBlocked(req) {
  const rec = failures.get(key(req));
  if (!rec) return false;
  if (Date.now() - rec.since > WINDOW_MS) {
    failures.delete(key(req));
    return false;
  }
  return rec.count >= MAX_FAILURES;
}

function recordFailure(req) {
  const k = key(req);
  const rec = failures.get(k);
  if (!rec || Date.now() - rec.since > WINDOW_MS) failures.set(k, { count: 1, since: Date.now() });
  else rec.count += 1;
}

function clear(req) {
  failures.delete(key(req));
}

module.exports = { isBlocked, recordFailure, clear, MAX_FAILURES, WINDOW_MS };
