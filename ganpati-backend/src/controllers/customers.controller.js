
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');

// POST /api/customers
async function createCustomer(req, res) {
  try {
    const { name, phone, email, address } = req.body || {};
    const customerName = typeof name === 'string' ? name.trim() : '';

    if (!customerName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = await pool.query(
      `INSERT INTO customers (name, phone, email, address)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        customerName,
        phone || null,
        email || null,
        address || null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return sendError(res, err, 'Failed to create customer');
  }
}

// GET /api/customers
async function listCustomers(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM customers ORDER BY name'
    );

    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to fetch customers');
  }
}

module.exports = { createCustomer, listCustomers };
