// Creates the database and all tables automatically when the server starts,
// and adds any columns that older versions of the database are missing.
// (So nobody has to run `mysql ... < schema.sql` by hand.)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { dbConfig } = require('./env');

// Columns added after the first release. Existing databases get them via ALTER TABLE.
const NEW_COLUMNS = [
  { table: 'raw_imports', column: 'lc_no', ddl: 'ADD COLUMN lc_no VARCHAR(60) NULL AFTER supplier_name' },
  { table: 'processing_batches', column: 'batch_no', ddl: 'ADD COLUMN batch_no VARCHAR(60) NULL AFTER sub_type' },
  { table: 'sales', column: 'bill_no', ddl: 'ADD COLUMN bill_no VARCHAR(60) NULL AFTER customer_id' }
];

// Columns the app needs in each table. If a table that already exists lacks any of them
// (for example it was created earlier with a different design), it is NOT deleted:
// it is renamed to <table>_old_<date_time> as a backup and a correct table is created.
// (payments is not listed: the app no longer uses it, so it is never touched.)
const REQUIRED_COLUMNS = {
  customers: ['id', 'name', 'phone', 'email', 'address'],
  raw_imports: ['id', 'material_type', 'sub_type', 'quantity_kg', 'rate_per_kg', 'total_cost', 'supplier_name', 'import_date'],
  processing_batches: [
    'id', 'material_type', 'sub_type', 'input_qty_kg', 'output_qty_kg', 'wastage_kg', 'processing_cost', 'processing_date'
  ],
  sales: ['id', 'customer_id', 'material_type', 'sub_type', 'quantity_kg', 'rate_per_kg', 'total_amount', 'sale_date', 'due_date']
};
// Optional columns the app knows about (never a reason to reject a table).
const KNOWN_OPTIONAL = ['created_at', 'lc_no', 'batch_no', 'bill_no'];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Renames tables that exist but do not match what the app needs. Returns what it did.
async function archiveIncompatibleTables(conn, database) {
  const archived = [];
  for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS def, EXTRA AS extra
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, table]
    );
    if (cols.length === 0) continue; // table does not exist yet: it will simply be created

    const have = cols.map((c) => String(c.name).toLowerCase());
    const missing = required.filter((c) => !have.includes(c));
    const known = new Set([...required, ...KNOWN_OPTIONAL]);
    // An unknown column that must be filled in would make every save fail.
    const mustFill = cols
      .filter((c) => !known.has(String(c.name).toLowerCase()))
      .filter((c) => c.nullable === 'NO' && c.def === null && !/auto_increment|generated/i.test(String(c.extra)))
      .map((c) => String(c.name));
    if (missing.length === 0 && mustFill.length === 0) continue;

    const backup = `${table}_old_${stamp()}`;
    await conn.query(`RENAME TABLE \`${table}\` TO \`${backup}\``);

    // Detach the backup copy from the other tables (drop its foreign keys) so it is a plain,
    // free-standing archive. Names are read AFTER the rename because MySQL renames
    // automatically-named keys together with the table. This is only tidying: if it fails,
    // the backup is still complete, so errors here are ignored.
    const [fks] = await conn.query(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
      [database, backup]
    );
    for (const fk of fks) {
      try {
        await conn.query(`ALTER TABLE \`${backup}\` DROP FOREIGN KEY \`${fk.name}\``);
      } catch (err) {
        /* ignore */
      }
    }
    archived.push({ table, backup, missing, mustFill });
  }
  return archived;
}

// schema.sql is the single source of truth for the tables.
function readSchemaStatements() {
  const file = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.sql'), 'utf8');
  return file
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !/^(CREATE DATABASE|USE)\b/i.test(s));
}

async function initDatabase() {
  const { database, ...server } = dbConfig;
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    const err = new Error('DB_NAME in .env may only contain letters, numbers and underscores.');
    err.code = 'BAD_DB_NAME';
    throw err;
  }

  // 1) Create the database itself if it does not exist yet.
  const first = await mysql.createConnection(server);
  try {
    await first.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
  } catch (err) {
    // A restricted MySQL user may not be allowed to create databases. That is fine
    // if the database already exists; if it does not, the next step reports the problem.
    if (!['ER_DBACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR'].includes(err.code)) throw err;
  } finally {
    await first.end();
  }

  // 2) Create tables, then 3) add missing columns.
  const conn = await mysql.createConnection({ ...server, database });
  const report = { archived: [], addedColumns: [] };
  try {
    report.archived = await archiveIncompatibleTables(conn, database);
    for (const statement of readSchemaStatements()) {
      await conn.query(statement);
    }
    for (const { table, column, ddl } of NEW_COLUMNS) {
      const [rows] = await conn.query(
        'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [database, table, column]
      );
      if (rows.length === 0) {
        await conn.query(`ALTER TABLE \`${table}\` ${ddl}`);
        report.addedColumns.push(`${table}.${column}`);
      }
    }
  } finally {
    await conn.end();
  }
  return report;
}

module.exports = { initDatabase };
