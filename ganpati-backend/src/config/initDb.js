
const pool = require('./db');

async function initDatabase() {
  await pool.query('SELECT 1');

  return {
    archived: [],
    addedColumns: [],
    database: 'PostgreSQL',
    connected: true,
  };
}

module.exports = { initDatabase };
