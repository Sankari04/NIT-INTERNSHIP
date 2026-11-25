const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { initDatabase } = require('../database/initDb');

async function seedDatabase({ silent = false } = {}) {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_PASSWORD to a private password of at least 12 characters before seeding.');
  }

  await initDatabase();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [tables] = await conn.query('SHOW TABLES');
    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0];
      const [[rowCount]] = await conn.query(
        `SELECT COUNT(*) AS count FROM ${conn.escapeId(tableName)}`
      );
      if (Number(rowCount.count) > 0) {
        throw new Error(
          `Refusing to seed non-empty database: ${tableName} already contains data. Use a new empty database.`
        );
      }
    }

    // 1. Demo Users (all 4 roles)
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const users = [
      ['Demo Admin', 'admin@kaverisnacks.com', passwordHash, 'admin'],
      ['Demo Salesman', 'salesman@kaverisnacks.com', passwordHash, 'salesman'],
      ['Demo Production Supervisor', 'production@kaverisnacks.com', passwordHash, 'production'],
      ['Demo Auditor', 'auditor@kaverisnacks.com', passwordHash, 'auditor'],
    ];

    for (const u of users) {
      await conn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        u
      );
    }

    // 2. Customers (Benchmark Retailer A in Tamil Nadu & Distributor B in Karnataka + 1 extra)
    await conn.query(
      `INSERT INTO customers (name, customer_type, contact_number, address, state, gstin) VALUES
      ('Retailer A', 'Retailer', '0000000000', 'Benchmark address, Madurai', 'Tamil Nadu', ''),
      ('Distributor B', 'Distributor', '0000000000', 'Benchmark address, Bengaluru', 'Karnataka', ''),
      ('Chennai Super Mart', 'Retailer', '0000000000', 'Benchmark address, Chennai', 'Tamil Nadu', '')`
    );

    // 3. Suppliers
    await conn.query(
      `INSERT INTO suppliers (name, contact_number, address) VALUES
      ('Cauvery Agro Mills', '0000000000', 'Benchmark supplier address, Thanjavur, Tamil Nadu'),
      ('Sri Amman Oils & Spices', '0000000000', 'Benchmark supplier address, Erode, Tamil Nadu'),
      ('Kaveri Packaging Works', '0000000000', 'Benchmark supplier address, Virudhunagar, Tamil Nadu')`
    );

    // 4. Products (Murukku 200 g matches benchmark opening stock 50 packets @ Rs.50, 5% GST)
    await conn.query(
      `INSERT INTO products (name, product_code, pack_size, selling_price, gst_percentage, hsn_code, opening_stock, current_stock) VALUES
      ('Murukku 200 g', 'MRK-200', '200 g', 50.00, 5.00, '21069099', 50.000, 50.000),
      ('Madras Mixture 250 g', 'MIX-250', '250 g', 65.00, 5.00, '21069099', 40.000, 40.000),
      ('Nendran Banana Chips 200 g', 'CHP-200', '200 g', 70.00, 5.00, '20089999', 30.000, 30.000),
      ('Mysore Pak 250 g', 'SWT-250', '250 g', 110.00, 5.00, '21069099', 25.000, 25.000)`
    );

    // 5. Raw Materials (Benchmark: Flour 100kg @ 42, Cooking oil 30L, Spice mix 5kg)
    await conn.query(
      `INSERT INTO raw_materials (name, unit, opening_stock, purchase_rate, current_stock, reorder_level) VALUES
      ('Flour', 'kg', 100.000, 42.0000, 100.000, 30.000),
      ('Cooking oil', 'litre', 30.000, 140.0000, 30.000, 10.000),
      ('Spice mix', 'kg', 5.000, 200.0000, 5.000, 2.000),
      ('Gram flour (Besan)', 'kg', 50.000, 75.0000, 50.000, 15.000),
      ('Raw Banana', 'kg', 40.000, 35.0000, 40.000, 15.000),
      ('Sugar & Ghee Mix', 'kg', 30.000, 180.0000, 30.000, 10.000)`
    );

    // 6. Packaging Materials (Benchmark: 200 g pouch 500 pcs, Cartons 30 pcs)
    await conn.query(
      `INSERT INTO packaging_materials (name, unit, opening_stock, purchase_rate, current_stock, reorder_level) VALUES
      ('200 g pouch', 'pieces', 500.000, 2.5000, 500.000, 100.000),
      ('Carton', 'pieces', 30.000, 15.0000, 30.000, 10.000),
      ('250 g pouch', 'pieces', 300.000, 2.5000, 300.000, 100.000)`
    );

    // 7. BOM for Murukku 200 g (Exact benchmark BOM) + Mixture & Chips BOMs
    const [bomMurukku] = await conn.query(
      `INSERT INTO bom (product_id, batch_name, expected_output, notes, created_by)
       VALUES (1, 'Standard Murukku 200g Batch', 200.000, 'Standard 200-packet batch BOM', 1)`
    );

    await conn.query(
      `INSERT INTO bom_items (bom_id, item_type, raw_material_id, packaging_material_id, standard_quantity, unit) VALUES
      (?, 'RAW_MATERIAL', 1, NULL, 40.000, 'kg'),
      (?, 'RAW_MATERIAL', 2, NULL, 10.000, 'litre'),
      (?, 'RAW_MATERIAL', 3, NULL, 1.200, 'kg'),
      (?, 'PACKAGING', NULL, 1, 200.000, 'pieces'),
      (?, 'PACKAGING', NULL, 2, 10.000, 'pieces')`,
      [bomMurukku.insertId, bomMurukku.insertId, bomMurukku.insertId, bomMurukku.insertId, bomMurukku.insertId]
    );

    const [bomMixture] = await conn.query(
      `INSERT INTO bom (product_id, batch_name, expected_output, notes, created_by)
       VALUES (2, 'Standard Mixture 250g Batch', 160.000, 'Standard 160-packet mixture batch', 1)`
    );

    await conn.query(
      `INSERT INTO bom_items (bom_id, item_type, raw_material_id, packaging_material_id, standard_quantity, unit) VALUES
      (?, 'RAW_MATERIAL', 4, NULL, 30.000, 'kg'),
      (?, 'RAW_MATERIAL', 2, NULL, 8.000, 'litre'),
      (?, 'RAW_MATERIAL', 3, NULL, 1.500, 'kg'),
      (?, 'PACKAGING', NULL, 3, 160.000, 'pieces'),
      (?, 'PACKAGING', NULL, 2, 8.000, 'pieces')`,
      [bomMixture.insertId, bomMixture.insertId, bomMixture.insertId, bomMixture.insertId, bomMixture.insertId]
    );

    // 8. Record Opening Stock Entries in Stock Ledger (so ledger history matches closing balances!)
    const openingDate = new Date().toISOString().slice(0, 10);

    await conn.query(
      `INSERT INTO stock_ledger (item_category, raw_material_id, item_name, unit, transaction_date, transaction_type, source_document, qty_received, qty_issued, closing_balance, created_by)
       SELECT 'RAW_MATERIAL', id, name, unit, ?, 'OPENING', 'OPENING-BALANCE', opening_stock, 0.000, current_stock, 1 FROM raw_materials`,
      [openingDate]
    );

    await conn.query(
      `INSERT INTO stock_ledger (item_category, packaging_material_id, item_name, unit, transaction_date, transaction_type, source_document, qty_received, qty_issued, closing_balance, created_by)
       SELECT 'PACKAGING', id, name, unit, ?, 'OPENING', 'OPENING-BALANCE', opening_stock, 0.000, current_stock, 1 FROM packaging_materials`,
      [openingDate]
    );

    await conn.query(
      `INSERT INTO stock_ledger (item_category, product_id, item_name, unit, transaction_date, transaction_type, source_document, qty_received, qty_issued, closing_balance, created_by)
       SELECT 'FINISHED_GOOD', id, name, 'packets', ?, 'OPENING', 'OPENING-BALANCE', opening_stock, 0.000, current_stock, 1 FROM products`,
      [openingDate]
    );

    await conn.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, details)
       VALUES (1, 'System', 'SEED_DATABASE', 'SYSTEM', 'Initial seed data loaded for Order-to-Audit Snacks Management System')`
    );

    await conn.commit();
    if (!silent) {
      console.log('Seed data inserted successfully.');
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
