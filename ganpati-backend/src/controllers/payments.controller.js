const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');

// POST /api/payments
async function createPayment(req, res) {
  try {
    const { sale_id, amount, payment_date, mode } = req.body;

    if (!sale_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'sale_id, amount and payment_date are required' });
    }

    const [[sale]] = await pool.query('SELECT * FROM sales WHERE id = ?', [sale_id]);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const [[paidRow]] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE sale_id = ?',
      [sale_id]
    );
    const alreadyPaid = Number(paidRow.paid);
    const dueBefore = Number(sale.total_amount) - alreadyPaid;

    if (Number(amount) > dueBefore) {
      return res.status(400).json({
        error: `Payment exceeds due amount. Due: ${dueBefore}, submitted: ${amount}`
      });
    }

    const [result] = await pool.query(
      'INSERT INTO payments (sale_id, amount, payment_date, mode) VALUES (?, ?, ?, ?)',
      [sale_id, amount, payment_date, mode || 'CASH']
    );

    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [result.insertId]);
    res.status(201).json({
      payment: rows[0],
      remaining_due: dueBefore - Number(amount)
    });
  } catch (err) {
    sendError(res, err, 'Failed to record payment');
  }
}

// GET /api/payments?sale_id=
async function listPayments(req, res) {
  try {
    const { sale_id } = req.query;
    let query = 'SELECT * FROM payments WHERE 1=1';
    const params = [];
    if (sale_id) { query += ' AND sale_id = ?'; params.push(sale_id); }
    query += ' ORDER BY payment_date DESC, id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Failed to fetch payments');
  }
}

module.exports = { createPayment, listPayments };
