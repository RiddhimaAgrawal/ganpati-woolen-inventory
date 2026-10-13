const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');

// POST /api/customers
async function createCustomer(req, res) {
  try {
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const [result] = await pool.query(
      'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
      [name, phone || null, email || null, address || null]
    );
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    sendError(res, err, 'Failed to create customer');
  }
}

// GET /api/customers
async function listCustomers(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY name');
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Failed to fetch customers');
  }
}

module.exports = { createCustomer, listCustomers };
