
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { AppError, replyError, parseId } = require('../utils/stock');

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

// PUT /api/customers/:id
async function updateCustomer(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new AppError(400, 'Invalid id');

    const { name, phone, email, address } = req.body || {};
    const customerName = typeof name === 'string' ? name.trim() : '';
    if (!customerName) throw new AppError(400, 'name is required');

    const result = await pool.query(
      `UPDATE customers
          SET name = $1, phone = $2, email = $3, address = $4
        WHERE id = $5
        RETURNING *`,
      [customerName, phone || null, email || null, address || null, id]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Customer not found');

    return res.json(result.rows[0]);
  } catch (err) {
    return replyError(res, err, 'Failed to update customer');
  }
}

// DELETE /api/customers/:id   (only if the customer has no sales)
async function deleteCustomer(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new AppError(400, 'Invalid id');

    const used = await pool.query('SELECT COUNT(*)::int AS n FROM sales WHERE customer_id = $1', [id]);
    if (used.rows[0].n > 0) {
      throw new AppError(
        400,
        `This customer has ${used.rows[0].n} sale(s) recorded, so they cannot be deleted. Delete those sales first, or just keep the customer.`
      );
    }

    const result = await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    if (result.rowCount === 0) throw new AppError(404, 'Customer not found');

    return res.json({ ok: true });
  } catch (err) {
    return replyError(res, err, 'Failed to delete customer');
  }
}

module.exports = { createCustomer, listCustomers, updateCustomer, deleteCustomer };
