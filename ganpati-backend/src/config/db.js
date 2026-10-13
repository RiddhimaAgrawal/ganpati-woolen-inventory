const mysql = require('mysql2/promise');
const { dbConfig, poolSize } = require('./env');

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: poolSize, // small on purpose: free cloud databases allow only a few connections
  queueLimit: 0,
  enableKeepAlive: true, // stops idle connections from being dropped by cloud databases
  keepAliveInitialDelay: 10000,
  dateStrings: true // return DATE columns as 'YYYY-MM-DD' (no timezone shifts)
});

module.exports = pool;
