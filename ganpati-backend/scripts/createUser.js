// Usage:  npm run create-user -- <username> <password> "<Full Name>" [--admin]
// Example: npm run create-user -- dad Secret123 "Dad" --admin
require('../src/config/env');
const pool = require('../src/config/db');
const { initDatabase } = require('../src/config/initDb');
const { hashPassword, passwordProblem } = require('../src/auth/password');

(async () => {
  const args = process.argv.slice(2).filter((a) => a !== '--admin');
  const isAdmin = process.argv.includes('--admin');
  const [username, password, name] = args;
  if (!username || !password) {
    console.log('Usage: npm run create-user -- <username> <password> "<Full Name>" [--admin]');
    process.exit(1);
  }
  const problem = passwordProblem(password);
  if (problem) { console.log(problem); process.exit(1); }
  try {
    await initDatabase();
    await pool.query('INSERT INTO users (username, name, password_hash, is_admin) VALUES (?, ?, ?, ?)', [
      username.trim().toLowerCase(), name || username, await hashPassword(password), isAdmin ? 1 : 0
    ]);
    console.log(`Created ${isAdmin ? 'admin ' : ''}user "${username}".`);
  } catch (err) {
    console.log(err.code === 'ER_DUP_ENTRY' ? `The username "${username}" already exists.` : `Failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
