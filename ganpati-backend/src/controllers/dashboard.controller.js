
const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');

// GET /api/dashboard/stock
async function getStockSummary(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        t.material_type,
        t.sub_type,
        COALESCE(i.total_imported, 0) AS total_imported_kg,
        COALESCE(p.total_input, 0) AS total_processed_input_kg,
        COALESCE(i.total_imported, 0) -
          COALESCE(p.total_input, 0) AS raw_stock_remaining_kg,
        COALESCE(p.total_output, 0) AS total_finished_produced_kg,
        COALESCE(s.total_sold, 0) AS total_sold_kg,
        COALESCE(p.total_output, 0) -
          COALESCE(s.total_sold, 0) AS finished_stock_in_hand_kg
      FROM (
        SELECT material_type, sub_type FROM raw_imports
        UNION
        SELECT material_type, sub_type FROM processing_batches
        UNION
        SELECT material_type, sub_type FROM sales
      ) t
      LEFT JOIN (
        SELECT material_type, sub_type,
               SUM(quantity_kg) AS total_imported
        FROM raw_imports
        GROUP BY material_type, sub_type
      ) i
        ON i.material_type = t.material_type
       AND i.sub_type = t.sub_type
      LEFT JOIN (
        SELECT material_type, sub_type,
               SUM(input_qty_kg) AS total_input,
               SUM(output_qty_kg) AS total_output
        FROM processing_batches
        GROUP BY material_type, sub_type
      ) p
        ON p.material_type = t.material_type
       AND p.sub_type = t.sub_type
      LEFT JOIN (
        SELECT material_type, sub_type,
               SUM(quantity_kg) AS total_sold
        FROM sales
        GROUP BY material_type, sub_type
      ) s
        ON s.material_type = t.material_type
       AND s.sub_type = t.sub_type
      ORDER BY t.material_type, t.sub_type
    `);

    return res.json(result.rows);
  } catch (err) {
    return sendError(res, err, 'Failed to build stock summary');
  }
}

// GET /api/dashboard/dues
async function getDuesSummary(req, res) {
  try {
    const result = await pool.query(`
      WITH sale_balances AS (
        SELECT
          s.id AS sale_id,
          s.customer_id,
          s.total_amount,
          s.due_date,
          s.total_amount - COALESCE(p.paid_amount, 0) AS due_amount
        FROM sales s
        LEFT JOIN (
          SELECT sale_id, SUM(amount) AS paid_amount
          FROM payments
          GROUP BY sale_id
        ) p ON p.sale_id = s.id
      )
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        SUM(sb.total_amount) AS total_billed,
        SUM(sb.total_amount - sb.due_amount) AS total_paid,
        SUM(sb.due_amount) AS total_due,
        SUM(
          CASE
            WHEN sb.due_date < CURRENT_DATE AND sb.due_amount > 0
            THEN sb.due_amount
            ELSE 0
          END
        ) AS overdue_amount
      FROM sale_balances sb
      JOIN customers c ON c.id = sb.customer_id
      GROUP BY c.id, c.name
      HAVING SUM(sb.due_amount) > 0
      ORDER BY SUM(sb.due_amount) DESC
    `);

    const byCustomer = result.rows.map((row) => ({
      ...row,
      total_billed: Number(row.total_billed),
      total_paid: Number(row.total_paid),
      total_due: Number(row.total_due),
      overdue_amount: Number(row.overdue_amount),
    }));

    const overall = byCustomer.reduce(
      (acc, row) => {
        acc.total_due += row.total_due;
        acc.overdue_amount += row.overdue_amount;
        return acc;
      },
      { total_due: 0, overdue_amount: 0 }
    );

    return res.json({
      overall,
      by_customer: byCustomer,
    });
  } catch (err) {
    return sendError(res, err, 'Failed to build dues summary');
  }
}

module.exports = { getStockSummary, getDuesSummary };
