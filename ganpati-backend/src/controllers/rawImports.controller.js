const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');

// POST /api/raw-imports
async function createRawImport(req, res) {
  try {
    const { material_type, sub_type, quantity_kg, rate_per_kg, supplier_name, lc_no, import_date } = req.body;

    if (!material_type || !sub_type || !quantity_kg || !rate_per_kg || !import_date) {
      return res.status(400).json({ error: 'material_type, sub_type, quantity_kg, rate_per_kg and import_date are required' });
    }
    if (!['FIBER', 'WOOL'].includes(material_type)) {
      return res.status(400).json({ error: "material_type must be 'FIBER' or 'WOOL'" });
    }

    const [result] = await pool.query(
      `INSERT INTO raw_imports (material_type, sub_type, quantity_kg, rate_per_kg, supplier_name, lc_no, import_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [material_type, String(sub_type).trim(), quantity_kg, rate_per_kg, cleanText(supplier_name, 150), cleanText(lc_no), import_date]
    );

    const [rows] = await pool.query('SELECT * FROM raw_imports WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    sendError(res, err, 'Failed to create raw import');
  }
}

// GET /api/raw-imports  (optional query filters: material_type, sub_type)
async function listRawImports(req, res) {
  try {
    const { material_type, sub_type } = req.query;
    let query = 'SELECT * FROM raw_imports WHERE 1=1';
    const params = [];

    if (material_type) {
      query += ' AND material_type = ?';
      params.push(material_type);
    }
    if (sub_type) {
      query += ' AND sub_type = ?';
      params.push(sub_type);
    }
    query += ' ORDER BY import_date DESC, id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Failed to fetch raw imports');
  }
}

module.exports = { createRawImport, listRawImports };
