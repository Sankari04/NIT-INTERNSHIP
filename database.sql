-- Order-to-Audit Management System for South Indian Snacks Manufacturing
-- MySQL / MariaDB Relational Schema (20 Tables)

-- Select or create the target database before running this schema.
-- All table declarations are idempotent and do not remove existing data.

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'salesman', 'production', 'auditor') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  customer_type ENUM('Retailer', 'Distributor') NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  state VARCHAR(80) NOT NULL,
  gstin VARCHAR(30) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Products (Finished Goods)
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  product_code VARCHAR(50) NOT NULL UNIQUE,
  pack_size VARCHAR(50) NOT NULL,
  selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  gst_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  hsn_code VARCHAR(30) NOT NULL DEFAULT '21069099',
  opening_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Raw Materials
CREATE TABLE IF NOT EXISTS raw_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  unit VARCHAR(30) NOT NULL,
  opening_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  purchase_rate DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
  current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  reorder_level DECIMAL(12, 3) NOT NULL DEFAULT 10.000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Packaging Materials
CREATE TABLE IF NOT EXISTS packaging_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  unit VARCHAR(30) NOT NULL,
  opening_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  purchase_rate DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
  current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  reorder_level DECIMAL(12, 3) NOT NULL DEFAULT 20.000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Bill of Materials (BOM Header)
CREATE TABLE IF NOT EXISTS bom (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL UNIQUE,
  batch_name VARCHAR(100) NOT NULL DEFAULT 'Standard Batch',
  expected_output DECIMAL(12, 3) NOT NULL,
  notes TEXT,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. Bill of Materials Items
CREATE TABLE IF NOT EXISTS bom_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bom_id INT NOT NULL,
  item_type ENUM('RAW_MATERIAL', 'PACKAGING') NOT NULL,
  raw_material_id INT NULL,
  packaging_material_id INT NULL,
  standard_quantity DECIMAL(12, 3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT,
  FOREIGN KEY (packaging_material_id) REFERENCES packaging_materials(id) ON DELETE RESTRICT
);

-- 9. Sales Orders
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  salesman_id INT NOT NULL,
  order_date DATE NOT NULL,
  status ENUM('Submitted', 'Approved', 'Rejected', 'Invoiced', 'Dispatched') NOT NULL DEFAULT 'Submitted',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  dispatched_by INT NULL,
  dispatched_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (salesman_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (dispatched_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 10. Sales Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  gst_percentage DECIMAL(5, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- 11. Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id INT NOT NULL,
  purchase_date DATE NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 12. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  item_type ENUM('RAW_MATERIAL', 'PACKAGING') NOT NULL,
  raw_material_id INT NULL,
  packaging_material_id INT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  rate DECIMAL(12, 4) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT,
  FOREIGN KEY (packaging_material_id) REFERENCES packaging_materials(id) ON DELETE RESTRICT
);

-- 13. Production Runs
CREATE TABLE IF NOT EXISTS production_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_number VARCHAR(60) NOT NULL UNIQUE,
  product_id INT NOT NULL,
  bom_id INT NOT NULL,
  production_date DATE NOT NULL,
  batches_count DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  expected_output DECIMAL(12, 3) NOT NULL,
  actual_good_packets DECIMAL(12, 3) NOT NULL,
  damaged_packaging DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  wastage_qty DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  cartons_used DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  yield_variance_pct DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  has_variance_alert BOOLEAN NOT NULL DEFAULT FALSE,
  total_raw_material_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_packaging_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_expense_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_production_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  cost_per_packet DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
  notes TEXT,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 14. Production Materials (Planned vs Actual Consumption)
CREATE TABLE IF NOT EXISTS production_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  production_run_id INT NOT NULL,
  item_type ENUM('RAW_MATERIAL', 'PACKAGING') NOT NULL,
  raw_material_id INT NULL,
  packaging_material_id INT NULL,
  material_name VARCHAR(150) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  planned_quantity DECIMAL(12, 3) NOT NULL,
  actual_quantity DECIMAL(12, 3) NOT NULL,
  variance_quantity DECIMAL(12, 3) NOT NULL,
  variance_pct DECIMAL(8, 2) NOT NULL,
  exceeds_threshold BOOLEAN NOT NULL DEFAULT FALSE,
  unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (production_run_id) REFERENCES production_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT,
  FOREIGN KEY (packaging_material_id) REFERENCES packaging_materials(id) ON DELETE RESTRICT
);

-- 15. Production Expenses (Labour, Gas & Electricity, Overheads)
CREATE TABLE IF NOT EXISTS production_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  production_run_id INT NOT NULL,
  expense_type VARCHAR(80) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (production_run_id) REFERENCES production_runs(id) ON DELETE CASCADE
);

-- 16. GST Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  financial_year VARCHAR(20) NOT NULL,
  order_id INT NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  supplier_state VARCHAR(80) NOT NULL,
  customer_state VARCHAR(80) NOT NULL,
  tax_type ENUM('CGST_SGST', 'IGST') NOT NULL,
  taxable_amount DECIMAL(12, 2) NOT NULL,
  cgst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  sgst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  igst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12, 2) NOT NULL,
  status ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  credit_note_number VARCHAR(50) NULL,
  cancellation_reason TEXT NULL,
  cancelled_by INT NULL,
  cancelled_at DATETIME NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 17. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  hsn_code VARCHAR(30) NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  gst_percentage DECIMAL(5, 2) NOT NULL,
  taxable_amount DECIMAL(12, 2) NOT NULL,
  cgst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  sgst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  igst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- 18. Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_id INT NOT NULL,
  customer_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_mode ENUM('Cash', 'UPI', 'Bank Transfer', 'Cheque') NOT NULL DEFAULT 'Bank Transfer',
  reference_number VARCHAR(100) DEFAULT '',
  notes TEXT,
  recorded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 19. Stock Ledger (Immutable Movement History)
CREATE TABLE IF NOT EXISTS stock_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_category ENUM('RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOOD') NOT NULL,
  raw_material_id INT NULL,
  packaging_material_id INT NULL,
  product_id INT NULL,
  item_name VARCHAR(150) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type ENUM('OPENING', 'PURCHASE', 'PRODUCTION_ISSUE', 'PRODUCTION_OUTPUT', 'DISPATCH', 'ADJUSTMENT') NOT NULL,
  source_document VARCHAR(80) NOT NULL,
  source_id INT NULL,
  qty_received DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  qty_issued DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  closing_balance DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (packaging_material_id) REFERENCES packaging_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 20. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
