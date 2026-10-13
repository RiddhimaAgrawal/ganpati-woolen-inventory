
require('./config/env');
const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function main() {
  try {
    const username = String(process.env.ADMIN_USERNAME || '')
      .trim()
      .toLowerCase();

    const password = process.env.ADMIN_PASSWORD || '';

    const db = await pool.query(
      'SELECT current_database() AS database, current_user AS db_user'
    );

    const result = await pool.query(
      `SELECT username, is_admin, password_hash
       FROM public.users
       WHERE LOWER(username) = $1`,
      [username]
    );

    console.log('Connected database:', db.rows[0].database);
    console.log('Database user:', db.rows[0].db_user);
    console.log('Configured username:', username);
    console.log('User found:', result.rowCount > 0);

    if (result.rowCount > 0) {
      const user = result.rows[0];

      console.log('Is admin:', user.is_admin);
      console.log(
        'Password hash looks like bcrypt:',
        /^\$2[aby]\$\d\d\$/.test(user.password_hash || '')
      );

      const matches = await bcrypt.compare(
        password,
        user.password_hash
      );

      console.log(
        'ADMIN_PASSWORD matches stored hash:',
        matches
      );
    }
  } catch (err) {
    console.error('Diagnostic failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
