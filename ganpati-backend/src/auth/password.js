const bcrypt = require('bcryptjs');

const MIN_LENGTH = 6;

const hashPassword = (plain) => bcrypt.hash(String(plain), 10);
const checkPassword = (plain, hash) => bcrypt.compare(String(plain), String(hash));

// A real-looking hash used so that "unknown user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function passwordProblem(plain) {
  if (typeof plain !== 'string' || plain.length < MIN_LENGTH) {
    return `The password must be at least ${MIN_LENGTH} characters.`;
  }
  if (plain.length > 72) return 'The password is too long (72 characters at most).';
  return null;
}

module.exports = { hashPassword, checkPassword, passwordProblem, DUMMY_HASH, MIN_LENGTH };
