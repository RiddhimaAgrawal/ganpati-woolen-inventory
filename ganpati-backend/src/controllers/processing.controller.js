const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');

// Helper: raw stock remaining for a given material_type + sub_type
// = total imported - total already consumed in processing
async function getRawStockRemaining(material_type, sub_type) {
  const [[imported]] = await pool.query(
    `SELECT COALESCE(SUM(quantity_kg), 0) AS total
     FROM raw_imports WHERE material_type = ? AND sub_type = ?`,
    [material_type, sub_type]
  );
  const [[consumed]] = await pool.query(
    `SELECT COALESCE(SUM(input_qty_kg), 0) AS total
     FROM processing_batches WHERE material_type = ? AND sub_type = ?`,
    [material_type, sub_type]
  );
  return Number(imported.total) - Number(consumed.total);
}

// POST /api/processing
async function createProcessingBatch(req, res) {
  try {
    const { material_type, sub_type, batch_no, input_qty_kg, output_qty_kg, processing_cost, processing_date } = req.body;

    if (!material_type || !sub_type || !input_qty_kg || !output_qty_kg || !processing_date) {
      return res.status(400).json({ error: 'material_type, sub_type, input_qty_kg, output_qty_kg and processing_date are required' });
    }
    if (Number(output_qty_kg) > Number(input_qty_kg)) {
      return res.status(400).json({ error: 'output_qty_kg cannot exceed input_qty_kg' });
    }

    const rawRemaining = await getRawStockRemaining(material_type, sub_type);
    if (Number(input_qty_kg) > rawRemaining) {
      return res.status(400).json({
        error: `Not enough raw stock. Available: ${rawRemaining} kg, requested: ${input_qty_kg} kg`
      });
    }

    const [result] = await pool.query(
      `INSERT INTO processing_batches (material_type, sub_type, batch_no, input_qty_kg, output_qty_kg, processing_cost, processing_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [material_type, sub_type, cleanText(batch_no), input_qty_kg, output_qty_kg, processing_cost || 0, processing_date]
    );

    const [rows] = await pool.query('SELECT * FROM processing_batches WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    sendError(res, err, 'Failed to create processing batch');
  }
}

// GET /api/processing
async function listProcessingBatches(req, res) {
  try {
    const { material_type, sub_type } = req.query;
    let query = 'SELECT * FROM processing_batches WHERE 1=1';
    const params = [];

    if (material_type) {
      query += ' AND material_type = ?';
      params.push(material_type);
    }
    if (sub_type) {
      query += ' AND sub_type = ?';
      params.push(sub_type);
    }
    query += ' ORDER BY processing_date DESC, id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Failed to fetch processing batches');
  }
}

module.exports = { createProcessingBatch, listProcessingBatches, getRawStockRemaining };
