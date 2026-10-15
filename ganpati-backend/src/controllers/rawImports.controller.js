
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');
const { AppError, replyError, parseId, stockTransaction } = require('../utils/stock');

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

// Check and clean the fields of a purchase. Throws an AppError with a clear message if something is wrong.
function readImportBody(body) {
  const { material_type, sub_type, quantity_kg, rate_per_kg, supplier_name, lc_no, import_date } = body || {};
  const subtype = typeof sub_type === 'string' ? sub_type.trim() : '';
  const quantity = Number(quantity_kg);
  const rate = Number(rate_per_kg);

  if (!material_type || !subtype || quantity_kg == null || rate_per_kg == null || !import_date) {
    throw new AppError(400, 'material_type, sub_type, quantity_kg, rate_per_kg and import_date are required');
  }
  if (!['FIBER', 'WOOL'].includes(material_type)) {
    throw new AppError(400, "material_type must be 'FIBER' or 'WOOL'");
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) {
    throw new AppError(400, 'quantity_kg must be positive and rate_per_kg cannot be negative');
  }

  return {
    material_type,
    sub_type: subtype,
    quantity,
    rate,
    supplier: cleanText(supplier_name, 150) || null,
    lc: cleanText(lc_no, 60) || null,
    import_date,
  };
}

// PUT /api/raw-imports/:id
async function updateRawImport(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new AppError(400, 'Invalid id');
    const v = readImportBody(req.body);

    const found = await pool.query(
      'SELECT material_type, sub_type FROM raw_imports WHERE id = $1',
      [id]
    );
    if (found.rows.length === 0) throw new AppError(404, 'Purchase not found');

    // Both the old and the new type are checked, in case the type/name was changed.
    const row = await stockTransaction([found.rows[0], v], async (client) => {
      const r = await client.query(
        `UPDATE raw_imports
            SET material_type = $1, sub_type = $2, quantity_kg = $3, rate_per_kg = $4,
                supplier_name = $5, lc_no = $6, import_date = $7
          WHERE id = $8
          RETURNING *`,
        [v.material_type, v.sub_type, v.quantity, v.rate, v.supplier, v.lc, v.import_date, id]
      );
      if (r.rows.length === 0) throw new AppError(404, 'Purchase not found');
      return r.rows[0];
    });

    return res.json(row);
  } catch (err) {
    return replyError(res, err, 'Failed to update purchase');
  }
}

// DELETE /api/raw-imports/:id
async function deleteRawImport(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new AppError(400, 'Invalid id');

    const found = await pool.query(
      'SELECT material_type, sub_type FROM raw_imports WHERE id = $1',
      [id]
    );
    if (found.rows.length === 0) throw new AppError(404, 'Purchase not found');

    await stockTransaction([found.rows[0]], async (client) => {
      await client.query('DELETE FROM raw_imports WHERE id = $1', [id]);
    });

    return res.json({ ok: true });
  } catch (err) {
    return replyError(res, err, 'Failed to delete purchase');
  }
}

module.exports = { createRawImport, listRawImports, updateRawImport, deleteRawImport };
