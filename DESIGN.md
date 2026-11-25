# System Design — Order-to-Audit Management System

## 1. Architecture Overview

The application follows a clean three-tier REST architecture:

1. **React + Vite Frontend (`frontend/`)**: Role-based single-page application using Axios with JWT bearer tokens, React Router route guards (`ProtectedRoute`), `jspdf` for PDF generation, and `xlsx` for Excel exports.
2. **Express.js Backend (`backend/`)**: Stateless JWT authentication, role-based middleware (`authorizeRoles`), pure calculation module (`services/calculationService.js`), transactional stock ledger (`services/ledgerService.js`), and audit logger (`services/auditService.js`).
3. **MySQL / MariaDB (`database.sql`)**: 20 normalized relational tables using `DECIMAL` columns for monetary and inventory quantities, foreign keys, and `InnoDB` transactions (`FOR UPDATE` row locks) on stock-mutating workflows.

---

## 2. Database Schema & Relationships (20 Tables)

- **Access & Audit:** `users`, `audit_logs`
- **Master Data:** `customers`, `suppliers`, `products`, `raw_materials`, `packaging_materials`
- **Bill of Materials:** `bom` (1:1 with `products`) -> `bom_items` (1:N referencing `raw_materials` or `packaging_materials`)
- **Purchases:** `purchases` (N:1 `suppliers`) -> `purchase_items`
- **Production & Costing:** `production_runs` (N:1 `products`, `bom`) -> `production_materials` (planned vs actual per item) & `production_expenses` (labour, gas & electricity, overheads)
- **Sales & Billing:** `orders` (N:1 `customers`, `users`) -> `order_items`; `invoices` (1:1 `orders`) -> `invoice_items`; `payments` (N:1 `invoices`, `customers`)
- **Inventory Ledger:** `stock_ledger` (immutable transaction history referencing `raw_materials`, `packaging_materials`, or `products` and the source document number)

---

## 3. Bill of Materials (BOM) & Production Variance Logic

Each finished product has a standard batch recipe (`bom` + `bom_items`):
- **Planned Material Quantity** = `standard_quantity × batches_count`
- **Expected Output** = `bom.expected_output × batches_count`
- **Yield Variance %** = `((actual_good_packets - expected_output) / expected_output) × 100`
- **Material Consumption Variance %** = `((actual_quantity - planned_quantity) / planned_quantity) × 100`
- Any yield variance or material consumption variance with `|variance| > 3%` triggers `exceeds_threshold = TRUE` and `has_variance_alert = TRUE` with explicit warning messages.

---

## 4. Transactional Stock Ledger Design

Stock balances are **never** updated by ad-hoc overwrites:
- `recordStockMovement(conn, ...)` runs inside an active database transaction (`BEGIN` ... `COMMIT`), acquires a `SELECT ... FOR UPDATE` row lock on the target item, validates that non-negative stock rules hold (`newBalance >= 0`), updates `current_stock`, and inserts an immutable row in `stock_ledger` containing:
  - `item_category` (`RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOOD`)
  - `transaction_type` (`OPENING`, `PURCHASE`, `PRODUCTION_ISSUE`, `PRODUCTION_OUTPUT`, `DISPATCH`, `ADJUSTMENT`)
  - `source_document` (e.g., `PUR-0001`, `BATCH-MRK-001`, `INV/FY26-27/0001`)
  - `qty_received`, `qty_issued`, `closing_balance`
- If any material or finished good lacks sufficient stock, the entire transaction rolls back cleanly.

---

## 5. GST Invoice & Shortage Enforcement

- **State-based Tax Rule:**
  - `supplier_state === customer_state` (e.g., Tamil Nadu → Tamil Nadu): `CGST = GST% / 2`, `SGST = GST% / 2`, `IGST = 0`.
  - `supplier_state !== customer_state` (e.g., Tamil Nadu → Karnataka): `CGST = 0`, `SGST = 0`, `IGST = GST%`.
- **Sequential Financial Year Numbering:** Indian April–March FY prefix (`INV/FY26-27/0001`).
- **Stock Shortage Enforcement:** Both invoice generation (`POST /api/invoices/from-order/:orderId`) and dispatch (`POST /api/orders/:id/dispatch`) verify finished-goods availability. If `available_stock < ordered_quantity`, the API returns HTTP `400` with the exact shortage quantity and keeps the order pending.
- **Immutability:** Invoices cannot be deleted; cancellations record a sequential Credit Note (`CN/FY26-27/0001`) and an `audit_logs` entry.
