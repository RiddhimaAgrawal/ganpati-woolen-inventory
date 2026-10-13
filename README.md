# Ganpati Woolen Industries — Stock Manager

```
ganpati-backend/    Node.js + Express + MySQL REST API (also serves the app screens)
ganpati-frontend/   React (Vite) app — big buttons, English / हिंदी
```

> **Want it on your dad's and brother's phones, without keeping your computer on?** See **DEPLOY.md**
> (free and paid cloud options, step by step). The app now has a login, so it is safe to put online.

## Setup (first time)

1. Install **Node.js** (LTS) and **MySQL**. Remember the MySQL password you choose.
2. In the `ganpati-backend` folder, make a copy of `.env.example` and name the copy exactly **`.env`**.
   Open it and replace `your_mysql_password` with your real MySQL password. Also choose the first login:
   `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Save.
3. Open a terminal in `ganpati-backend` and run:
   ```bash
   npm install
   npm start
   ```
4. Wait for this line in the terminal:  **✅ Database ready: connected, and all tables are in place.**
5. Open **http://localhost:5000** in the browser and log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you chose.
   Add your dad and brother on the **Account** tab.

You do **not** need to create the database or tables yourself. The server creates them
automatically every time it starts, and it also upgrades an older database (adding the new
LC / Batch / Bill number columns) without touching your existing data.

If your database already has tables made for a *different design* (for example an older `sales`
table with `product_name` / `quantity` / `unit_price`), the server **does not delete them**. It renames
them to a backup such as `sales_old_20261012_052509`, creates the correct table, and tells you in the
terminal exactly what it did. Your customers table is reused as it is. The backup tables stay in MySQL
if you ever need that old data.

To use it from a phone on the same Wi-Fi: `http://<computer-ip>:5000`.

## Screens

| Screen | What it does |
|---|---|
| 🏠 Home | Raw material waiting · ready stock · sold · stock per type |
| 📥 Buy | Record imported fiber/wool: type, kg, price/kg, date, supplier, **LC No.** |
| ⚙️ Process | Pick a raw material → **Batch No.**, kg in, kg out → waste % shown automatically |
| 🧾 Sell | **Bill No.**, customer (or add new), ready product, kg, rate |
| 👥 Customers | Add and find customers |
| 👤 Account | Change your password, log out. Admins add or remove people who can log in |

LC No., Batch No. and Bill No. are optional text fields (letters, numbers and dashes are fine, e.g. `LC-2026-001`).
They are not forced to be unique, because one LC or one bill can cover several lines.
Each "Recent entries" list has a search box that finds entries by these numbers.

## Troubleshooting: a red error box, or "Failed to build stock summary"

That means the backend cannot use MySQL. The reason is printed in the terminal window where you ran
`npm start`, and also shown at **http://localhost:5000/api/health**. Common ones:

- **"The password in the .env file is still the example text"** → edit `ganpati-backend/.env` and put
  your real MySQL password. The file must be named `.env` (not `.env.example`) and be inside `ganpati-backend`.
- **"Cannot log in to MySQL"** → `DB_USER` / `DB_PASSWORD` in `.env` are wrong.
- **"Cannot reach MySQL"** → the MySQL service is not running. Start it.
- **"…do not match this version of the app"** → stop the server (Ctrl+C) and run `npm start` again; it repairs the tables and keeps a backup of anything it replaces.

After changing `.env`, stop the server (Ctrl+C) and run `npm start` again.

## Developing the frontend

```bash
cd ganpati-backend  && npm run dev      # API on :5000
cd ganpati-frontend && npm run dev      # app on :5173 (auto-reloads)
cd ganpati-frontend && npm run build    # rebuild the screens served by the backend
```
