
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');

// POST /api/payments
async function createPayment(req, res) {
  let client;

  try {
    client = await pool.connect();

    const { sale_id, amount, payment_date, notes } = req.body || {};
    const paymentMethod = req.body?.payment_method || req.body?.mode || 'CASH';
    const saleId = Number(sale_id);
    const paymentAmount = Number(amount);

    if (!sale_id || amount == null || !payment_date) {
      return res.status(400).json({
        error: 'sale_id, amount and payment_date are required',
      });
    }

    if (!Number.isInteger(saleId) || saleId <= 0 ||
        !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        error: 'sale_id must be valid and amount must be positive',
      });
    }

    await client.query('BEGIN');

    // Serialize payment calculations for this sale.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), $2::integer)',
      ['payment', saleId]
    );

    const saleResult = await client.query(
      'SELECT id, total_amount FROM sales WHERE id = $1',
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }

    const paidResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM payments
       WHERE sale_id = $1`,
      [saleId]
    );

    const totalAmount = Number(saleResult.rows[0].total_amount);
    const alreadyPaid = Number(paidResult.rows[0].paid);
    const dueBefore = totalAmount - alreadyPaid;

    if (paymentAmount > dueBefore) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: `Payment exceeds due amount. Due: ${dueBefore}, submitted: ${paymentAmount}`,
      });
    }

    const result = await client.query(
      `INSERT INTO payments
         (sale_id, amount, payment_date, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        saleId,
        paymentAmount,
        payment_date,
        paymentMethod,
        notes || null,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      payment: result.rows[0],
      remaining_due: dueBefore - paymentAmount,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }

    return sendError(res, err, 'Failed to record payment');
  } finally {
    if (client) client.release();
  }
}

// GET /api/payments?sale_id=
async function listPayments(req, res) {
  try {
    const { sale_id } = req.query;
    let query = 'SELECT * FROM payments';
    const params = [];

    if (sale_id) {
      params.push(sale_id);
      query += ' WHERE sale_id = $1';
    }

    query += ' ORDER BY payment_date DESC, id DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to fetch payments');
  }
}

module.exports = { createPayment, listPayments };
