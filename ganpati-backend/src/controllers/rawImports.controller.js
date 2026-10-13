
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');

// POST /api/raw-imports
async function createRawImport(req, res) {
  try {
    const {
      material_type,
      sub_type,
      quantity_kg,
      rate_per_kg,
      supplier_name,
      lc_no,
      import_date,
    } = req.body || {};

    const subtype = typeof sub_type === 'string' ? sub_type.trim() : '';
    const quantity = Number(quantity_kg);
    const rate = Number(rate_per_kg);

    if (!material_type || !subtype || quantity_kg == null ||
        rate_per_kg == null || !import_date) {
      return res.status(400).json({
        error: 'material_type, sub_type, quantity_kg, rate_per_kg and import_date are required',
      });
    }

    if (!['FIBER', 'WOOL'].includes(material_type)) {
      return res.status(400).json({
        error: "material_type must be 'FIBER' or 'WOOL'",
      });
    }

    if (!Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({
        error: 'quantity_kg must be positive and rate_per_kg cannot be negative',
      });
    }

    const result = await pool.query(
      `INSERT INTO raw_imports
         (material_type, sub_type, quantity_kg, rate_per_kg,
          supplier_name, lc_no, import_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        material_type,
        subtype,
        quantity,
        rate,
        cleanText(supplier_name, 150) || null,
        cleanText(lc_no, 60) || null,
        import_date,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return sendError(res, err, 'Failed to create raw import');
  }
}

// GET /api/raw-imports
async function listRawImports(req, res) {
  try {
    const { material_type, sub_type } = req.query;
    const conditions = [];
    const params = [];

    if (material_type) {
      params.push(material_type);
      conditions.push(`material_type = $${params.length}`);
    }

    if (sub_type) {
      params.push(sub_type);
      conditions.push(`sub_type = $${params.length}`);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(
      `SELECT * FROM raw_imports
       ${where}
       ORDER BY import_date DESC, id DESC`,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to fetch raw imports');
  }
}

module.exports = { createRawImport, listRawImports };
