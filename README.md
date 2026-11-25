# Order-to-Audit System

A full-stack order, production, inventory, billing, payment, and audit application for a small snacks manufacturer. It is a demo/prototype, not statutory GST filing software.

## Features

- Role-based sign-in for Admin, Salesman, Production Supervisor, and Auditor.
- Product, customer, supplier, raw-material, and packaging master data.
- Product Bill of Materials (BOM), purchases, weighted-average material valuation, and stock ledger.
- Production runs with actual consumption, yield/material variance alerts, wastage, and batch costing.
- Sales orders, admin approval, stock-checked GST invoices, dispatch, and customer payments.
- Inventory, audit trail, 14 operational reports plus audit logs, CSV/Excel/PDF exports.

There is no separate Owner or Accountant role. The Auditor is read-only. GST uses configurable demo company details and is not certified for statutory filing.

## Technology

- Frontend: React 18, Vite, Axios, React Router, jsPDF, SheetJS (`xlsx`).
- Backend: Node.js, Express, JWT, bcrypt.
- Database: MySQL 8+ or MariaDB 10.4+, using `mysql2/promise`.

## Project layout

```text
database.sql                 Idempotent schema only; contains no seeded personal data
DESIGN.md                    Architecture, data relationships, and calculation design
backend/
  config/                    Database and company configuration
  controllers/ routes/       REST API and role-protected endpoints
  database/initDb.js         Creates the configured database/schema without dropping tables
  seed/seed.js               Seeds benchmark masters/accounts only into an empty database
  services/                  Calculations, stock ledger, and audit logging
  tests/                     Unit tests and an opt-in DB integration benchmark
frontend/src/                Role-based React pages and export utilities
```

## Prerequisites

- Node.js 18+ (22 recommended).
- MySQL 8+ or MariaDB 10.4+.

## Configure and initialize (PowerShell)

1. Copy the backend template and edit `backend\.env` locally. Never commit that file:

   ```powershell
   Set-Location 'backend'
   Copy-Item '.env.example' '.env'
   ```

2. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` for your MySQL server. Replace the demo company name, GSTIN, and address with your own details before generating invoices. Generate a private JWT key with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated value in `JWT_SECRET`. Choose a private `DEMO_PASSWORD` of at least 12 characters. Do not copy either value into source code, screenshots, or GitHub.

3. Install dependencies and initialize a fresh demo database:

   ```powershell
   npm install
   npm run init-db
   npm run seed
   ```

   `npm run init-db` creates missing tables using `CREATE TABLE IF NOT EXISTS`; it does not drop existing tables. The seed checks that the database is empty and refuses to seed if any table already contains rows. It never resets an existing database. To create a separate demo database, set `DB_NAME` in the local `.env` first.

4. In a second PowerShell terminal:

   ```powershell
   Set-Location 'frontend'
   npm install
   npm run dev
   ```

   Run the backend in its own terminal with `npm start` from `backend`. Open **http://localhost:5173**; the API listens on **http://localhost:5000**.

## Demo accounts

The seed creates these accounts; each gets the locally configured `DEMO_PASSWORD` (stored as a bcrypt hash):

| Role | Email |
|---|---|
| Admin | `admin@kaverisnacks.com` |
| Salesman | `salesman@kaverisnacks.com` |
| Production Supervisor | `production@kaverisnacks.com` |
| Auditor | `auditor@kaverisnacks.com` |

No password is published here. For an existing seeded database, use the password chosen when those accounts were created.

## Benchmark data and costing

The Murukku 200 g BOM yields 200 packets: Flour 40 kg, Cooking oil 10 L, Spice mix 1.2 kg, 200 pouches, and 10 cartons.

The current benchmark opening rates are Flour ₹42/kg, Cooking oil ₹140/L, Spice mix ₹200/kg, pouches ₹2.50 each, and cartons ₹15 each. After purchasing 60 kg flour at ₹45/kg, flour's weighted-average rate is ₹43.125/kg. For actual usage of 40 kg flour, 10.5 L oil, 1.2 kg spice, 194 pouches, 9 cartons, ₹1,200 labour, and ₹600 gas/power:

- Raw materials: ₹3,435.
- Packaging: ₹620.
- Total batch cost: ₹5,855.
- Cost per 188 good packets: ₹31.1436 (displayed as ₹31.14).

These inputs do not produce the older ₹30.07 cost target; the application does not alter its formulas to force that value. GST uses 5% in the demo data: intra-state sales split it into 2.5% CGST and 2.5% SGST; inter-state sales use 5% IGST.

## Safe checks and tests

Calculation unit tests do not connect to or change MySQL:

```powershell
Set-Location 'backend'
npm test
```

The integration benchmark writes purchases, production, orders, invoices, and payments. Run it only against a separate, disposable database whose name ends in `_test`; it leaves its scenario data in that database:

```powershell
Set-Location 'backend'
$env:DB_NAME = 'order_to_audit_test_db'
npm run test:benchmark
Remove-Item Env:DB_NAME
```

Use the local DB credentials and `DEMO_PASSWORD` from `backend\.env`. Do not point the integration test at a database containing data you need to keep. `npm run test:all` also runs the database integration test and has the same restriction.

## Database design

See [DESIGN.md](./DESIGN.md) for the architecture, relationships, stock ledger, BOM, and calculation logic. [database.sql](./database.sql) contains schema declarations only.
