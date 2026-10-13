const pool = require('../config/db');
const { sendError } = require('../utils/dbHelp');

// GET /api/dashboard/stock
// Shows, per material_type + sub_type:
//   raw stock remaining to process, quantity processed (finished), quantity sold, finished stock in hand
async function getStockSummary(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        t.material_type,
        t.sub_type,
        COALESCE(imported.total_imported, 0)          AS total_imported_kg,
        COALESCE(processed.total_input, 0)             AS total_processed_input_kg,
        COALESCE(imported.total_imported, 0) - COALESCE(processed.total_input, 0)
                                                          AS raw_stock_remaining_kg,
        COALESCE(processed.total_output, 0)             AS total_finished_produced_kg,
        COALESCE(sold.total_sold, 0)                    AS total_sold_kg,
        COALESCE(processed.total_output, 0) - COALESCE(sold.total_sold, 0)
                                                          AS finished_stock_in_hand_kg
      FROM (
        SELECT material_type, sub_type FROM raw_imports
        UNION
        SELECT material_type, sub_type FROM processing_batches
        UNION
        SELECT material_type, sub_type FROM sales
      ) t
      LEFT JOIN (
        SELECT material_type, sub_type, SUM(quantity_kg) AS total_imported
        FROM raw_imports GROUP BY material_type, sub_type
      ) imported ON imported.material_type = t.material_type AND imported.sub_type = t.sub_type
      LEFT JOIN (
        SELECT material_type, sub_type, SUM(input_qty_kg) AS total_input, SUM(output_qty_kg) AS total_output
        FROM processing_batches GROUP BY material_type, sub_type
      ) processed ON processed.material_type = t.material_type AND processed.sub_type = t.sub_type
      LEFT JOIN (
        SELECT material_type, sub_type, SUM(quantity_kg) AS total_sold
        FROM sales GROUP BY material_type, sub_type
      ) sold ON sold.material_type = t.material_type AND sold.sub_type = t.sub_type
      ORDER BY t.material_type, t.sub_type
    `);
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Failed to build stock summary');
  }
}

// GET /api/dashboard/dues
// Overall due amount + per-customer breakdown
async function getDuesSummary(req, res) {
  try {
    const [perCustomer] = await pool.query(`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        SUM(s.total_amount) AS total_billed,
        COALESCE(SUM(p.paid_amount), 0) AS total_paid,
        SUM(s.total_amount) - COALESCE(SUM(p.paid_amount), 0) AS total_due,
        SUM(CASE WHEN s.due_date < CURDATE()
                  AND (s.total_amount - COALESCE(p.paid_amount, 0)) > 0
                 THEN (s.total_amount - COALESCE(p.paid_amount, 0)) ELSE 0 END) AS overdue_amount
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN (
        SELECT sale_id, SUM(amount) AS paid_amount FROM payments GROUP BY sale_id
      ) p ON p.sale_id = s.id
      GROUP BY c.id, c.name
      HAVING total_due > 0
      ORDER BY total_due DESC
    `);

    const overall = perCustomer.reduce(
      (acc, row) => {
        acc.total_due += Number(row.total_due);
        acc.overdue_amount += Number(row.overdue_amount);
        return acc;
      },
      { total_due: 0, overdue_amount: 0 }
    );

    res.json({ overall, by_customer: perCustomer });
  } catch (err) {
    sendError(res, err, 'Failed to build dues summary');
  }
}

module.exports = { getStockSummary, getDuesSummary };
