
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');

// Must be called using the same transaction client as the write.
async function getRawStockRemaining(material_type, sub_type, client = pool) {
  const result = await client.query(
    `SELECT
       COALESCE(
         (SELECT SUM(quantity_kg)
          FROM raw_imports
          WHERE material_type = $1 AND sub_type = $2), 0
       ) -
       COALESCE(
         (SELECT SUM(input_qty_kg)
          FROM processing_batches
          WHERE material_type = $1 AND sub_type = $2), 0
       ) AS remaining`,
    [material_type, sub_type]
  );

  return Number(result.rows[0].remaining);
}

// POST /api/processing
async function createProcessingBatch(req, res) {
  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    const {
      material_type,
      sub_type,
      batch_no,
      input_qty_kg,
      output_qty_kg,
      processing_cost,
      processing_date,
    } = req.body || {};

    const subtype = typeof sub_type === 'string' ? sub_type.trim() : '';
    const inputQty = Number(input_qty_kg);
    const outputQty = Number(output_qty_kg);
    const cost = processing_cost == null || processing_cost === ''
      ? 0
      : Number(processing_cost);

    if (!material_type || !subtype || input_qty_kg == null ||
        output_qty_kg == null || !processing_date) {
      return res.status(400).json({
        error: 'material_type, sub_type, input_qty_kg, output_qty_kg and processing_date are required',
      });
    }

    if (!['FIBER', 'WOOL'].includes(material_type)) {
      return res.status(400).json({
        error: "material_type must be 'FIBER' or 'WOOL'",
      });
    }

    if (!Number.isFinite(inputQty) || inputQty <= 0 ||
        !Number.isFinite(outputQty) || outputQty <= 0 ||
        !Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({
        error: 'Quantities must be positive and processing cost cannot be negative',
      });
    }

    if (outputQty > inputQty) {
      return res.status(400).json({
        error: 'output_qty_kg cannot exceed input_qty_kg',
      });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    // Serialize raw-stock changes for this material and subtype.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [`raw:${material_type}`, subtype]
    );

    const rawRemaining = await getRawStockRemaining(
      material_type,
      subtype,
      client
    );

    if (inputQty > rawRemaining) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        error: `Not enough raw stock. Available: ${rawRemaining} kg, requested: ${inputQty} kg`,
      });
    }

    // Serialize changes to finished stock with sale creation.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [`finished:${material_type}`, subtype]
    );

    const result = await client.query(
      `INSERT INTO processing_batches
         (material_type, sub_type, batch_no, input_qty_kg,
          output_qty_kg, processing_cost, processing_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        material_type,
        subtype,
        cleanText(batch_no, 60) || null,
        inputQty,
        outputQty,
        cost,
        processing_date,
      ]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }

    return sendError(res, err, 'Failed to create processing batch');
  } finally {
    client.release();
  }
}

// GET /api/processing
async function listProcessingBatches(req, res) {
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
      `SELECT * FROM processing_batches
       ${where}
       ORDER BY processing_date DESC, id DESC`,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to fetch processing batches');
  }
}

module.exports = {
  createProcessingBatch,
  listProcessingBatches,
  getRawStockRemaining,
};
