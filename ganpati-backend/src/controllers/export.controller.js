// Month-end Excel report.
//
//   GET /api/export/excel?month=2026-10     one month (purchases, processing, sales, payments)
//   GET /api/export/excel                   everything ever entered
//
// Customers and Stock are always "as of today", because they describe the current position.

const pool = require('../config/db');
const { AppError, replyError } = require('../utils/stock');
const { buildWorkbook, dateSerial, colName } = require('../utils/xlsx');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const material = (m) => (m === 'WOOL' ? 'Wool' : m === 'FIBER' ? 'Fiber' : m || '');

// ───────── Build one table sheet ─────────
// columns: { h: heading, w: width, key | get, t: 'text'|'num'|'money'|'date'|'int'|'pct', sum: true }
function buildTable(name, columns, data) {
  const rows = [columns.map((c) => ({ v: c.h, s: 'header' }))];

  for (const row of data) {
    rows.push(
      columns.map((c) => {
        const raw = c.get ? c.get(row) : row[c.key];
        if (c.t === 'date') return { v: dateSerial(raw), s: 'date' };
        if (c.t === 'text') return { v: raw === null || raw === undefined ? '' : String(raw) };
        return { v: num(raw), s: c.t };
      })
    );
  }

  const count = data.length;
  const lastDataRow = count + 1;
  const sums = {};

  if (count > 0) {
    const totalRow = lastDataRow + 1;
    const totalStyle = { num: 'totalNum', money: 'totalMoney', int: 'totalInt', pct: 'totalPct' };

    columns.forEach((c, i) => {
      if (c.sum) {
        const total = round2(data.reduce((acc, row) => acc + (num(c.get ? c.get(row) : row[c.key]) || 0), 0));
        sums[c.key || c.h] = total;
      }
    });

    rows.push(
      columns.map((c, i) => {
        const L = colName(i);
        if (c.sum) {
          return { f: `SUM(${L}2:${L}${lastDataRow})`, v: sums[c.key || c.h], s: totalStyle[c.t] || 'totalNum' };
        }
        if (c.totalFormula) {
          const f = c.totalFormula(totalRow);
          return { f: f.f, v: f.v(sums), s: totalStyle[c.t] || 'totalNum' };
        }
        return { v: i === 0 ? 'Total' : '', s: 'totalLabel' };
      })
    );
  }

  const letterOf = (key) => colName(columns.findIndex((c) => (c.key || c.h) === key));

  return {
    sheet: {
      name,
      widths: columns.map((c) => c.w || 14),
      freezeRows: 1,
      filterRow: 1,
      filterLastRow: lastDataRow,
      rows,
    },
    count,
    sums,
    // e.g. Purchases!G2:G40 — or null when the sheet has no data rows
    range: (key) => (count > 0 ? `${name}!${letterOf(key)}2:${letterOf(key)}${lastDataRow}` : null),
  };
}

// Either a live formula over a detail sheet, or a plain 0 when the sheet is empty.
function cellOver(range, fn, value, style) {
  return range ? { f: `${fn}(${range})`, v: value, s: style } : { v: 0, s: style };
}

// ───────── Main handler ─────────
async function exportExcel(req, res) {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    let from = null;
    let to = null;
    let periodLabel = 'All data (everything entered so far)';

    if (month) {
      const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
      if (!m) throw new AppError(400, 'month must look like 2026-10');
      const y = Number(m[1]);
      const mo = Number(m[2]);
      from = `${m[1]}-${m[2]}-01`;
      to = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
      periodLabel = `${MONTHS[mo - 1]} ${y}`;
    }

    const period = (col) => `($1::date IS NULL OR ${col} >= $1::date) AND ($2::date IS NULL OR ${col} < $2::date)`;
    const params = [from, to];

    const paidPerSale = `(SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id)`;

    const [imports, batches, sales, payments, customers, stock] = await Promise.all([
      pool.query(
        `SELECT id, to_char(import_date, 'YYYY-MM-DD') AS d, material_type, sub_type, supplier_name, lc_no,
                quantity_kg, rate_per_kg, quantity_kg * rate_per_kg AS total
           FROM raw_imports
          WHERE ${period('import_date')}
          ORDER BY import_date, id`,
        params
      ),
      pool.query(
        `SELECT id, to_char(processing_date, 'YYYY-MM-DD') AS d, material_type, sub_type, batch_no,
                input_qty_kg, output_qty_kg, input_qty_kg - output_qty_kg AS wastage, processing_cost
           FROM processing_batches
          WHERE ${period('processing_date')}
          ORDER BY processing_date, id`,
        params
      ),
      pool.query(
        `SELECT s.id, to_char(s.sale_date, 'YYYY-MM-DD') AS d, s.bill_no, c.name AS customer,
                s.material_type, s.sub_type, s.quantity_kg, s.rate_per_kg,
                s.quantity_kg * s.rate_per_kg AS total,
                COALESCE(p.paid, 0) AS paid,
                s.quantity_kg * s.rate_per_kg - COALESCE(p.paid, 0) AS due,
                to_char(s.due_date, 'YYYY-MM-DD') AS due_date,
                CASE
                  WHEN s.quantity_kg * s.rate_per_kg - COALESCE(p.paid, 0) <= 0 THEN 'Paid'
                  WHEN s.due_date < CURRENT_DATE THEN 'Overdue'
                  ELSE 'Pending'
                END AS status
           FROM sales s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN ${paidPerSale} p ON p.sale_id = s.id
          WHERE ${period('s.sale_date')}
          ORDER BY s.sale_date, s.id`,
        params
      ),
      pool.query(
        `SELECT p.id, to_char(p.payment_date, 'YYYY-MM-DD') AS d, c.name AS customer, s.bill_no,
                p.sale_id, p.amount, p.payment_method, p.notes
           FROM payments p
           JOIN sales s ON s.id = p.sale_id
           JOIN customers c ON c.id = s.customer_id
          WHERE ${period('p.payment_date')}
          ORDER BY p.payment_date, p.id`,
        params
      ),
      pool.query(
        `SELECT c.id, c.name, c.phone, c.email, c.address,
                COALESCE(b.billed, 0) AS billed,
                COALESCE(b.paid, 0) AS paid,
                COALESCE(b.billed, 0) - COALESCE(b.paid, 0) AS due,
                COALESCE(b.overdue, 0) AS overdue
           FROM customers c
           LEFT JOIN (
             SELECT s.customer_id,
                    SUM(s.quantity_kg * s.rate_per_kg) AS billed,
                    SUM(COALESCE(p.paid, 0)) AS paid,
                    SUM(CASE
                          WHEN s.due_date < CURRENT_DATE
                           AND s.quantity_kg * s.rate_per_kg - COALESCE(p.paid, 0) > 0
                          THEN s.quantity_kg * s.rate_per_kg - COALESCE(p.paid, 0)
                          ELSE 0
                        END) AS overdue
               FROM sales s
               LEFT JOIN ${paidPerSale} p ON p.sale_id = s.id
              GROUP BY s.customer_id
           ) b ON b.customer_id = c.id
          ORDER BY c.name`
      ),
      pool.query(
        `SELECT t.material_type, t.sub_type,
                COALESCE(i.total_imported, 0) AS bought,
                COALESCE(p.total_input, 0) AS processed,
                COALESCE(i.total_imported, 0) - COALESCE(p.total_input, 0) AS raw_left,
                COALESCE(p.total_output, 0) AS produced,
                COALESCE(s.total_sold, 0) AS sold,
                COALESCE(p.total_output, 0) - COALESCE(s.total_sold, 0) AS finished_left
           FROM (
             SELECT material_type, sub_type FROM raw_imports
             UNION SELECT material_type, sub_type FROM processing_batches
             UNION SELECT material_type, sub_type FROM sales
           ) t
           LEFT JOIN (SELECT material_type, sub_type, SUM(quantity_kg) AS total_imported
                        FROM raw_imports GROUP BY material_type, sub_type) i
                  ON i.material_type = t.material_type AND i.sub_type = t.sub_type
           LEFT JOIN (SELECT material_type, sub_type, SUM(input_qty_kg) AS total_input, SUM(output_qty_kg) AS total_output
                        FROM processing_batches GROUP BY material_type, sub_type) p
                  ON p.material_type = t.material_type AND p.sub_type = t.sub_type
           LEFT JOIN (SELECT material_type, sub_type, SUM(quantity_kg) AS total_sold
                        FROM sales GROUP BY material_type, sub_type) s
                  ON s.material_type = t.material_type AND s.sub_type = t.sub_type
          ORDER BY t.material_type, t.sub_type`
      ),
    ]);

    // ───── Detail sheets ─────
    const purchases = buildTable('Purchases', [
      { h: 'ID', key: 'id', t: 'int', w: 7 },
      { h: 'Date', key: 'd', t: 'date', w: 14 },
      { h: 'Material', get: (r) => material(r.material_type), t: 'text', w: 11 },
      { h: 'Type / name', key: 'sub_type', t: 'text', w: 22 },
      { h: 'Supplier', key: 'supplier_name', t: 'text', w: 24 },
      { h: 'LC no.', key: 'lc_no', t: 'text', w: 14 },
      { h: 'Quantity (kg)', key: 'quantity_kg', t: 'num', w: 14, sum: true },
      { h: 'Rate (₹/kg)', key: 'rate_per_kg', t: 'money', w: 14 },
      { h: 'Total cost (₹)', key: 'total', t: 'money', w: 16, sum: true },
    ], imports.rows);

    const processing = buildTable('Processing', [
      { h: 'ID', key: 'id', t: 'int', w: 7 },
      { h: 'Date', key: 'd', t: 'date', w: 14 },
      { h: 'Material', get: (r) => material(r.material_type), t: 'text', w: 11 },
      { h: 'Type / name', key: 'sub_type', t: 'text', w: 22 },
      { h: 'Batch no.', key: 'batch_no', t: 'text', w: 14 },
      { h: 'Raw used (kg)', key: 'input_qty_kg', t: 'num', w: 14, sum: true },
      { h: 'Finished made (kg)', key: 'output_qty_kg', t: 'num', w: 18, sum: true },
      { h: 'Wastage (kg)', key: 'wastage', t: 'num', w: 14, sum: true },
      {
        h: 'Wastage %',
        key: 'wastage_pct',
        get: (r) => (Number(r.input_qty_kg) > 0 ? Number(r.wastage) / Number(r.input_qty_kg) : 0),
        t: 'pct',
        w: 12,
        // Total row: total wastage / total raw used
        totalFormula: (totalRow) => ({
          f: `IF(F${totalRow}=0,0,H${totalRow}/F${totalRow})`,
          v: (sums) => (sums.input_qty_kg > 0 ? sums.wastage / sums.input_qty_kg : 0),
        }),
      },
      { h: 'Processing cost (₹)', key: 'processing_cost', t: 'money', w: 20, sum: true },
    ], batches.rows);

    const salesSheet = buildTable('Sales', [
      { h: 'ID', key: 'id', t: 'int', w: 7 },
      { h: 'Date', key: 'd', t: 'date', w: 14 },
      { h: 'Bill no.', key: 'bill_no', t: 'text', w: 12 },
      { h: 'Customer', key: 'customer', t: 'text', w: 24 },
      { h: 'Material', get: (r) => material(r.material_type), t: 'text', w: 11 },
      { h: 'Type / name', key: 'sub_type', t: 'text', w: 22 },
      { h: 'Quantity (kg)', key: 'quantity_kg', t: 'num', w: 14, sum: true },
      { h: 'Rate (₹/kg)', key: 'rate_per_kg', t: 'money', w: 14 },
      { h: 'Bill amount (₹)', key: 'total', t: 'money', w: 16, sum: true },
      { h: 'Received so far (₹)', key: 'paid', t: 'money', w: 19, sum: true },
      { h: 'Still due (₹)', key: 'due', t: 'money', w: 16, sum: true },
      { h: 'Due date', key: 'due_date', t: 'date', w: 14 },
      { h: 'Status', key: 'status', t: 'text', w: 11 },
    ], sales.rows);

    const paymentsSheet = buildTable('Payments', [
      { h: 'ID', key: 'id', t: 'int', w: 7 },
      { h: 'Date', key: 'd', t: 'date', w: 14 },
      { h: 'Customer', key: 'customer', t: 'text', w: 24 },
      { h: 'Bill no.', key: 'bill_no', t: 'text', w: 12 },
      { h: 'Sale ID', key: 'sale_id', t: 'int', w: 9 },
      { h: 'Amount (₹)', key: 'amount', t: 'money', w: 16, sum: true },
      { h: 'Method', key: 'payment_method', t: 'text', w: 12 },
      { h: 'Notes', key: 'notes', t: 'text', w: 30 },
    ], payments.rows);

    const customersSheet = buildTable('Customers', [
      { h: 'ID', key: 'id', t: 'int', w: 7 },
      { h: 'Name', key: 'name', t: 'text', w: 26 },
      { h: 'Phone', key: 'phone', t: 'text', w: 16 },
      { h: 'Email', key: 'email', t: 'text', w: 26 },
      { h: 'Address', key: 'address', t: 'text', w: 30 },
      { h: 'Total billed (₹)', key: 'billed', t: 'money', w: 17, sum: true },
      { h: 'Total received (₹)', key: 'paid', t: 'money', w: 18, sum: true },
      { h: 'Due now (₹)', key: 'due', t: 'money', w: 16, sum: true },
      { h: 'Overdue now (₹)', key: 'overdue', t: 'money', w: 17, sum: true },
    ], customers.rows);

    const stockSheet = buildTable('Stock', [
      { h: 'Material', get: (r) => material(r.material_type), t: 'text', w: 11 },
      { h: 'Type / name', key: 'sub_type', t: 'text', w: 22 },
      { h: 'Bought (kg)', key: 'bought', t: 'num', w: 14, sum: true },
      { h: 'Used in processing (kg)', key: 'processed', t: 'num', w: 22, sum: true },
      { h: 'Raw stock left (kg)', key: 'raw_left', t: 'num', w: 19, sum: true },
      { h: 'Finished made (kg)', key: 'produced', t: 'num', w: 18, sum: true },
      { h: 'Sold (kg)', key: 'sold', t: 'num', w: 12, sum: true },
      { h: 'Finished stock in hand (kg)', key: 'finished_left', t: 'num', w: 26, sum: true },
    ], stock.rows);

    // ───── Summary sheet ─────
    const processedIn = processing.sums.input_qty_kg || 0;
    const processedOut = processing.sums.output_qty_kg || 0;
    const wasted = processing.sums.wastage || 0;
    const wastePct = processedIn > 0 ? ((wasted / processedIn) * 100).toFixed(1) : '0.0';
    const rawNow = stockSheet.sums.raw_left || 0;
    const finishedNow = stockSheet.sums.finished_left || 0;
    const dueNow = customersSheet.sums.due || 0;
    const overdueNow = customersSheet.sums.overdue || 0;

    const generatedOn = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const summary = {
      name: 'Summary',
      widths: [38, 12, 18, 20, 44],
      hideGrid: true,
      rows: [
        [{ v: 'Ganpati Woolen Industries', s: 'title' }],
        [{ v: 'Stock & sales report', s: 'note' }],
        [],
        [{ v: 'Period', s: 'label' }, { v: periodLabel, s: 'bold' }],
        [{ v: 'Created on', s: 'label' }, { v: generatedOn }],
        [{ v: 'Created by', s: 'label' }, { v: (req.user && req.user.name) || '' }],
        [],
        [
          { v: 'What happened in this period', s: 'header' },
          { v: 'Entries', s: 'header' },
          { v: 'Quantity (kg)', s: 'header' },
          { v: 'Amount (₹)', s: 'header' },
          { v: 'Details', s: 'header' },
        ],
        [
          { v: 'Raw material bought' },
          cellOver(purchases.range('id'), 'COUNT', purchases.count, 'int'),
          cellOver(purchases.range('quantity_kg'), 'SUM', purchases.sums.quantity_kg || 0, 'num'),
          cellOver(purchases.range('total'), 'SUM', purchases.sums.total || 0, 'money'),
          { v: 'Amount = total cost of purchases', s: 'note' },
        ],
        [
          { v: 'Processing (raw used)' },
          cellOver(processing.range('id'), 'COUNT', processing.count, 'int'),
          cellOver(processing.range('input_qty_kg'), 'SUM', processedIn, 'num'),
          cellOver(processing.range('processing_cost'), 'SUM', processing.sums.processing_cost || 0, 'money'),
          {
            v: `Finished made ${round2(processedOut)} kg · wastage ${round2(wasted)} kg (${wastePct}%) · amount = processing cost`,
            s: 'note',
          },
        ],
        [
          { v: 'Sales' },
          cellOver(salesSheet.range('id'), 'COUNT', salesSheet.count, 'int'),
          cellOver(salesSheet.range('quantity_kg'), 'SUM', salesSheet.sums.quantity_kg || 0, 'num'),
          cellOver(salesSheet.range('total'), 'SUM', salesSheet.sums.total || 0, 'money'),
          { v: 'Amount = total billed', s: 'note' },
        ],
        [
          { v: 'Payments received' },
          cellOver(paymentsSheet.range('id'), 'COUNT', paymentsSheet.count, 'int'),
          { v: null },
          cellOver(paymentsSheet.range('amount'), 'SUM', paymentsSheet.sums.amount || 0, 'money'),
          { v: 'Money received from customers in this period', s: 'note' },
        ],
        [],
        [
          { v: 'Position as of today', s: 'header' },
          { v: '', s: 'header' },
          { v: 'Quantity (kg)', s: 'header' },
          { v: 'Amount (₹)', s: 'header' },
          { v: 'Details', s: 'header' },
        ],
        [
          { v: 'Raw stock in hand' },
          { v: null },
          { v: round2(rawNow), s: 'num' },
          { v: null },
          { v: 'See the Stock sheet for each type', s: 'note' },
        ],
        [
          { v: 'Finished stock in hand' },
          { v: null },
          { v: round2(finishedNow), s: 'num' },
          { v: null },
          { v: 'Made but not yet sold', s: 'note' },
        ],
        [
          { v: 'Money still to receive' },
          { v: null },
          { v: null },
          { v: round2(dueNow), s: 'money' },
          { v: 'From all sales, not just this period (see Customers sheet)', s: 'note' },
        ],
        [
          { v: 'Of which overdue' },
          { v: null },
          { v: null },
          { v: round2(overdueNow), s: 'money' },
          { v: 'Past the due date and still unpaid', s: 'note' },
        ],
      ],
    };

    const buffer = buildWorkbook([
      summary,
      purchases.sheet,
      processing.sheet,
      salesSheet.sheet,
      paymentsSheet.sheet,
      customersSheet.sheet,
      stockSheet.sheet,
    ]);

    const fileName = month ? `Ganpati_Report_${month}.xlsx` : 'Ganpati_All_Data.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (err) {
    return replyError(res, err, 'Failed to create the Excel file');
  }
}

module.exports = { exportExcel };
