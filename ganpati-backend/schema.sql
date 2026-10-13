-- Ganpati Woolen Industries — database tables.
--
-- You normally do NOT need to run this file: the server creates the database and
-- all tables by itself every time it starts (see src/config/initDb.js).
-- It is kept for reference, or if you prefer to set things up by hand:
--   mysql -u root -p < schema.sql        (use Command Prompt / Git Bash, not PowerShell)

CREATE DATABASE IF NOT EXISTS ganpati_woolen;
USE ganpati_woolen;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(150),
  address       VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw material imports  (material_type: FIBER or WOOL; sub_type: e.g. Merino, Grade A)
-- lc_no = Letter of Credit number of the import (optional)
CREATE TABLE IF NOT EXISTS raw_imports (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  material_type   ENUM('FIBER', 'WOOL') NOT NULL,
  sub_type        VARCHAR(100) NOT NULL,
  quantity_kg     DECIMAL(10,2) NOT NULL,
  rate_per_kg     DECIMAL(10,2) NOT NULL,
  total_cost      DECIMAL(12,2) GENERATED ALWAYS AS (quantity_kg * rate_per_kg) STORED,
  supplier_name   VARCHAR(150),
  lc_no           VARCHAR(60) NULL,
  import_date     DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_raw_imports_type (material_type, sub_type),
  KEY idx_raw_imports_lc (lc_no)
);

-- Processing: raw material -> finished product (pooled by type)
-- batch_no = production batch number (optional)
CREATE TABLE IF NOT EXISTS processing_batches (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  material_type         ENUM('FIBER', 'WOOL') NOT NULL,
  sub_type              VARCHAR(100) NOT NULL,
  batch_no              VARCHAR(60) NULL,
  input_qty_kg          DECIMAL(10,2) NOT NULL,
  output_qty_kg         DECIMAL(10,2) NOT NULL,
  wastage_kg            DECIMAL(10,2) GENERATED ALWAYS AS (input_qty_kg - output_qty_kg) STORED,
  processing_cost       DECIMAL(12,2) NOT NULL DEFAULT 0,
  processing_date       DATE NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_processing_type (material_type, sub_type),
  KEY idx_processing_batch (batch_no)
);

-- Sales: finished product -> customer
-- bill_no = bill / invoice number (optional). One bill can have several lines, so it is not unique.
CREATE TABLE IF NOT EXISTS sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  bill_no         VARCHAR(60) NULL,
  material_type   ENUM('FIBER', 'WOOL') NOT NULL,
  sub_type        VARCHAR(100) NOT NULL,
  quantity_kg     DECIMAL(10,2) NOT NULL,
  rate_per_kg     DECIMAL(10,2) NOT NULL,
  total_amount    DECIMAL(12,2) GENERATED ALWAYS AS (quantity_kg * rate_per_kg) STORED,
  sale_date       DATE NOT NULL,
  due_date        DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  KEY idx_sales_type (material_type, sub_type),
  KEY idx_sales_due_date (due_date),
  KEY idx_sales_bill (bill_no)
);

-- Payments received against a sale (kept in the database; the app screen for it was removed)
CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  sale_id         INT NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  payment_date    DATE NOT NULL,
  mode            ENUM('CASH', 'BANK', 'UPI', 'OTHER') DEFAULT 'CASH',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

-- People who can log in to the app.
-- token_version goes up whenever a password changes, which logs that person out everywhere else.
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL,
  name           VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  is_admin       TINYINT(1)   NOT NULL DEFAULT 0,
  token_version  INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username)
);
