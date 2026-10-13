
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');

async function getFinishedStockRemaining(material_type, sub_type, client = pool) {
  const result = await client.query(
    `SELECT
       COALESCE(
         (SELECT SUM(output_qty_kg)
          FROM processing_batches
          WHERE material_type = $1 AND sub_type = $2), 0
       ) -
       COALESCE(
         (SELECT SUM(quantity_kg)
          FROM sales
          WHERE material_type = $1 AND sub_type = $2), 0
       ) AS remaining`,
    [material_type, sub_type]
  );

  return Number(result.rows[0].remaining);
}

// POST /api/sales
async function createSale(req, res) {
  let client;

  try {
    client = await pool.connect();

    const {
      customer_id,
      bill_no,
      material_type,
      sub_type,
      quantity_kg,
      rate_per_kg,
      sale_date,
      due_date,
    } = req.body || {};

    const customerId = Number(customer_id);
    const quantity = Number(quantity_kg);
    const rate = Number(rate_per_kg);
    const subtype = typeof sub_type === 'string' ? sub_type.trim() : '';

    if (!customer_id || !material_type || !subtype ||
        quantity_kg == null || rate_per_kg == null ||
        !sale_date || !due_date) {
      return res.status(400).json({
        error: 'customer_id, material_type, sub_type, quantity_kg, rate_per_kg, sale_date and due_date are required',
      });
    }

    if (!Number.isInteger(customerId) || customerId <= 0 ||
        !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({
        error: 'customer_id must be valid, quantity must be positive, and rate cannot be negative',
      });
    }

    if (!['FIBER', 'WOOL'].includes(material_type)) {
      return res.status(400).json({
        error: "material_type must be 'FIBER' or 'WOOL'",
      });
    }

    await client.query('BEGIN');

    // Coordinate sales with other sales and processing batches.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [`finished:${material_type}`, subtype]
    );

    const stockRemaining = await getFinishedStockRemaining(
      material_type,
      subtype,
      client
    );

    if (quantity > stockRemaining) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: `Not enough finished stock. Available: ${stockRemaining} kg, requested: ${quantity} kg`,
      });
    }

    const result = await client.query(
      `INSERT INTO sales
         (customer_id, bill_no, material_type, sub_type,
          quantity_kg, rate_per_kg, sale_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        customerId,
        cleanText(bill_no, 60) || null,
        material_type,
        subtype,
        quantity,
        rate,
        sale_date,
        due_date,
      ]
    );

    const sale = result.rows[0];

    const customerResult = await client.query(
      'SELECT name, phone, email FROM customers WHERE id = $1',
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query('COMMIT');

    return res.status(201).json({
      ...sale,
      customer_name: customerResult.rows[0].name,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }

    return sendError(res, err, 'Failed to create sale');
  } finally {
    if (client) client.release();
  }
}

// GET /api/sales
async function listSales(req, res) {
  try {
    const { customer_id, material_type, sub_type, status } = req.query;
    const conditions = [];
    const params = [];

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`s.customer_id = $${params.length}`);
    }

    if (material_type) {
      params.push(material_type);
      conditions.push(`s.material_type = $${params.length}`);
    }

    if (sub_type) {
      params.push(sub_type);
      conditions.push(`s.sub_type = $${params.length}`);
    }

    if (status === 'pending') {
      conditions.push(
        '(s.total_amount - COALESCE(p.paid_amount, 0)) > 0'
      );
    }

    if (status === 'overdue') {
      conditions.push(
        `(s.total_amount - COALESCE(p.paid_amount, 0)) > 0
         AND s.due_date < CURRENT_DATE`
      );
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(
      `SELECT
         s.*,
         c.name AS customer_name,
         c.phone AS customer_phone,
         c.email AS customer_email,
         COALESCE(p.paid_amount, 0) AS paid_amount,
         s.total_amount - COALESCE(p.paid_amount, 0) AS due_amount
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN (
         SELECT sale_id, SUM(amount) AS paid_amount
         FROM payments
         GROUP BY sale_id
       ) p ON p.sale_id = s.id
       ${where}
       ORDER BY s.sale_date DESC, s.id DESC`,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to fetch sales');
  }
}

module.exports = {
  createSale,
  listSales,
  getFinishedStockRemaining,
};
