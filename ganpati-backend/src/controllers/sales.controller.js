
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');
const { cleanText } = require('../utils/text');
const { AppError, replyError, parseId, stockTransaction } = require('../utils/stock');

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

function readSaleBody(body) {
  const { customer_id, bill_no, material_type, sub_type, quantity_kg, rate_per_kg, sale_date, due_date } = body || {};
  const customerId = Number(customer_id);
  const quantity = Number(quantity_kg);
  const rate = Number(rate_per_kg);
  const subtype = typeof sub_type === 'string' ? sub_type.trim() : '';

  if (!customer_id || !material_type || !subtype || quantity_kg == null || rate_per_kg == null ||
      !sale_date || !due_date) {
    throw new AppError(400, 'customer_id, material_type, sub_type, quantity_kg, rate_per_kg, sale_date and due_date are required');
  }
  if (!Number.isInteger(customerId) || customerId <= 0 || !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(rate) || rate < 0) {
    throw new AppError(400, 'customer_id must be valid, quantity must be positive, and rate cannot be negative');
  }
  if (!['FIBER', 'WOOL'].includes(material_type)) {
    throw new AppError(400, "material_type must be 'FIBER' or 'WOOL'");
  }

  return {
    customerId,
    bill_no: cleanText(bill_no, 60) || null,
    material_type,
    sub_type: subtype,
    quantity,
    rate,
    sale_date,
    due_date,
  };
}

// PUT /api/sales/:id
async function updateSale(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new AppError(400, 'Invalid id');
    const v = readSaleBody(req.body);

    const found = await pool.query(
      'SELECT material_type, sub_type FROM sales WHERE id = $1',
      [id]
    );
    if (found.rows.length === 0) throw new AppError(404, 'Sale not found');

    const row = await stockTransaction([found.rows[0], v], async (client) => {
      // Same lock the payments screen uses, so the paid amount cannot change under us.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2::integer)', ['payment', id]);

      const cust = await client.query('SELECT name FROM customers WHERE id = $1', [v.customerId]);
      if (cust.rows.length === 0) throw new AppError(404, 'Customer not found');

      const paid = await client.query(
        'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE sale_id = $1',
        [id]
      );
      const newTotal = v.quantity * v.rate;
      if (newTotal < Number(paid.rows[0].paid) - 0.005) {
        throw new AppError(
          400,
          `The new total (${newTotal}) is less than the ${Number(paid.rows[0].paid)} already received for this sale.`
        );
      }

      const r = await client.query(
        `UPDATE sales
            SET customer_id = $1, bill_no = $2, material_type = $3, sub_type = $4,
                quantity_kg = $5, rate_per_kg = $6, sale_date = $7, due_date = $8
          WHERE id = $9
          RETURNING *`,
        [v.customerId, v.bill_no, v.material_type, v.sub_type, v.quantity, v.rate, v.sale_date, v.due_date, id]
      );
      if (r.rows.length === 0) throw new AppError(404, 'Sale not found');
      return { ...r.rows[0], customer_name: cust.rows[0].name };
    });

    return res.json(row);
  } catch (err) {
    return replyError(res, err, 'Failed to update sale');
  }
}

// DELETE /api/sales/:id   (any payments recorded against the sale are deleted with it)
async function deleteSale(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new AppError(400, 'Invalid id');

    const found = await pool.query(
      'SELECT material_type, sub_type FROM sales WHERE id = $1',
      [id]
    );
    if (found.rows.length === 0) throw new AppError(404, 'Sale not found');

    const removed = await stockTransaction([found.rows[0]], async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2::integer)', ['payment', id]);
      const pay = await client.query('DELETE FROM payments WHERE sale_id = $1', [id]);
      await client.query('DELETE FROM sales WHERE id = $1', [id]);
      return pay.rowCount;
    });

    return res.json({ ok: true, payments_deleted: removed });
  } catch (err) {
    return replyError(res, err, 'Failed to delete sale');
  }
}

module.exports = {
  createSale,
  listSales,
  getFinishedStockRemaining,
  updateSale,
  deleteSale,
};
