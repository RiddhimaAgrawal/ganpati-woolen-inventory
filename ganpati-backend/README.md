# Ganpati Woolen Industries — Backend API

Tracks raw fiber/wool imports, processing and sales, with live stock numbers.

## Setup

```bash
cp .env.example .env      # then put your real MySQL password inside .env
npm install
npm start                 # or: npm run dev
```

Everything except `POST /api/auth/login` and `GET /api/health` needs a login token
(`Authorization: Bearer <token>`). Accounts live in the `users` table (passwords are stored hashed with bcrypt).
Create the first admin with `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`, or `npm run create-user -- dad Secret123 "Dad" --admin`.
Admins add the rest of the family from the app's Account tab (`/api/users`).

The server creates the database and tables by itself on start-up (see `src/config/initDb.js`) and
upgrades older databases. `schema.sql` is kept for reference. Check http://localhost:5000/api/health
if anything looks wrong.

## Data model (see schema.sql)

- **raw_imports** — what came in: type, quantity, rate, date, supplier, `lc_no` (Letter of Credit no.)
- **processing_batches** — raw → finished: `batch_no`, input/output qty (wastage auto-calculated), cost
- **sales** — finished → customer: `bill_no`, type, quantity, rate, sale date, due date
- **payments** — money received against a sale
- **customers** — buyer records
- Stock and dues are never stored directly — they're always computed from these tables, so numbers can't drift out of sync.

## API Reference

### Customers
```
POST /api/customers          { name, phone, email, address }
GET  /api/customers
```

### Raw material imports
```
POST /api/raw-imports
  { material_type: "WOOL", sub_type: "Merino", quantity_kg: 5000, rate_per_kg: 450, supplier_name: "ABC Traders", lc_no: "LC-2026-001", import_date: "2026-09-01" }

GET  /api/raw-imports?material_type=WOOL&sub_type=Merino
```

### Processing (raw → finished)
```
POST /api/processing
  { material_type: "WOOL", sub_type: "Merino", batch_no: "B-101", input_qty_kg: 5000, output_qty_kg: 4650, processing_cost: 15000, processing_date: "2026-09-02" }

GET  /api/processing?material_type=WOOL
```
Rejects the request if `input_qty_kg` exceeds current raw stock for that type.

### Sales (finished → customer)
```
POST /api/sales
  { customer_id: 1, bill_no: "BILL-7781", material_type: "WOOL", sub_type: "Merino", quantity_kg: 1000, rate_per_kg: 520, sale_date: "2026-09-03", due_date: "2026-09-17" }

GET  /api/sales                       -> all sales, with paid_amount & due_amount per row
GET  /api/sales?status=pending        -> sales with a nonzero due amount
GET  /api/sales?status=overdue        -> due amount > 0 AND past due_date
```
Rejects the request if `quantity_kg` exceeds current finished stock for that type.

### Payments (API only — the screen for it was removed from the app)
```
POST /api/payments
  { sale_id: 1, amount: 200000, payment_date: "2026-09-10", mode: "BANK" }

GET  /api/payments?sale_id=1
```
Rejects the request if `amount` exceeds the sale's remaining due amount.

### Dashboard
(`/api/dashboard/dues` still exists but the app no longer uses it.)
```
GET /api/dashboard/stock
```
Returns, per material_type + sub_type:
`total_imported_kg, raw_stock_remaining_kg, total_finished_produced_kg, total_sold_kg, finished_stock_in_hand_kg`

```
GET /api/dashboard/dues
```
Returns overall total due + overdue amount, plus a per-customer breakdown.
