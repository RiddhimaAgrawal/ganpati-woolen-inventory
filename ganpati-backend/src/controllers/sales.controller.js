const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');

// Helper: finished stock remaining for a material_type + sub_type
// = total processed output - total already sold
async function getFinishedStockRemaining(material_type, sub_type) {
  const [[processed]] = await pool.query(
    `SELECT COALESCE(SUM(output_qty_kg), 0) AS total
     FROM processing_batches WHERE material_type = ? AND sub_type = ?`,
    [material_type, sub_type]
  );
  const [[sold]] = await pool.query(
    `SELECT COALESCE(SUM(quantity_kg), 0) AS total
     FROM sales WHERE material_type = ? AND sub_type = ?`,
    [material_type, sub_type]
  );
  return Number(processed.total) - Number(sold.total);
}

// POST /api/sales
async function createSale(req, res) {
  try {
    const { customer_id, bill_no, material_type, sub_type, quantity_kg, rate_per_kg, sale_date, due_date } = req.body;

    if (!customer_id || !material_type || !sub_type || !quantity_kg || !rate_per_kg || !sale_date || !due_date) {
      return res.status(400).json({
        error: 'customer_id, material_type, sub_type, quantity_kg, rate_per_kg, sale_date and due_date are required'
      });
    }

    const finishedRemaining = await getFinishedStockRemaining(material_type, sub_type);
    if (Number(quantity_kg) > finishedRemaining) {
      return res.status(400).json({
        error: `Not enough finished stock. Available: ${finishedRemaining} kg, requested: ${quantity_kg} kg`
      });
    }

    const [result] = await pool.query(
      `INSERT INTO sales (customer_id, bill_no, material_type, sub_type, quantity_kg, rate_per_kg, sale_date, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, cleanText(bill_no), material_type, sub_type, quantity_kg, rate_per_kg, sale_date, due_date]
    );

    const [rows] = await pool.query(
      `SELECT s.*, c.name AS customer_name
       FROM sales s JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    sendError(res, err, 'Failed to create sale');
  }
}

// GET /api/sales  (optional filters: customer_id, material_type, sub_type, status=pending|overdue)
async function listSales(req, res) {
  try {
    const { customer_id, material_type, sub_type, status } = req.query;

    let query = `
      SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
             COALESCE(p.paid_amount, 0) AS paid_amount,
             (s.total_amount - COALESCE(p.paid_amount, 0)) AS due_amount
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN (
        SELECT sale_id, SUM(amount) AS paid_amount FROM payments GROUP BY sale_id
      ) p ON p.sale_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) { query += ' AND s.customer_id = ?'; params.push(customer_id); }
    if (material_type) { query += ' AND s.material_type = ?'; params.push(material_type); }
    if (sub_type) { query += ' AND s.sub_type = ?'; params.push(sub_type); }
    if (status === 'pending') { query += ' AND (s.total_amount - COALESCE(p.paid_amount, 0)) > 0'; }
    if (status === 'overdue') { query += ' AND (s.total_amount - COALESCE(p.paid_amount, 0)) > 0 AND s.due_date < CURDATE()'; }

    query += ' ORDER BY s.sale_date DESC, s.id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Failed to fetch sales');
  }
}

module.exports = { createSale, listSales, getFinishedStockRemaining };
