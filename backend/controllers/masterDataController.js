const pool = require('../config/db');
const { logAudit } = require('../services/auditService');

// ---------------- PRODUCTS ----------------
async function listProducts(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id ASC');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load products.' });
  }
}

async function createProduct(req, res) {
  const conn = await pool.getConnection();
  try {
    const { name, product_code, pack_size, selling_price, gst_percentage, hsn_code, opening_stock = 0 } = req.body;
    if (!name || !product_code || !pack_size || selling_price === undefined) {
      return res.status(400).json({ message: 'Name, product code, pack size, and selling price are required.' });
    }

    await conn.beginTransaction();
    const openQty = Number(opening_stock) || 0;
    const [result] = await conn.query(
      `INSERT INTO products (name, product_code, pack_size, selling_price, gst_percentage, hsn_code, opening_stock, current_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), product_code.trim(), pack_size.trim(), Number(selling_price), Number(gst_percentage ?? 5), (hsn_code || '21069099').trim(), openQty, openQty]
    );

    if (openQty > 0) {
      await conn.query(
        `INSERT INTO stock_ledger (item_category, product_id, item_name, unit, transaction_date, transaction_type, source_document, qty_received, qty_issued, closing_balance, created_by)
         VALUES ('FINISHED_GOOD', ?, ?, 'packets', CURDATE(), 'OPENING', 'OPENING-BALANCE', ?, 0, ?, ?)`,
        [result.insertId, name.trim(), openQty, openQty, req.user.id]
      );
    }

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: result.insertId,
      details: `Created product ${name} (${product_code})`,
    });

    await conn.commit();
    const [[created]] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    return res.status(201).json(created);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Product code already exists.' });
    }
    return res.status(500).json({ message: 'Failed to create product.' });
  } finally {
    conn.release();
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, product_code, pack_size, selling_price, gst_percentage, hsn_code } = req.body;
    await pool.query(
      `UPDATE products SET name = ?, product_code = ?, pack_size = ?, selling_price = ?, gst_percentage = ?, hsn_code = ?
       WHERE id = ?`,
      [name.trim(), product_code.trim(), pack_size.trim(), Number(selling_price), Number(gst_percentage ?? 5), (hsn_code || '21069099').trim(), id]
    );
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: Number(id),
      details: `Updated product ${name} (${product_code})`,
    });
    const [[updated]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update product.' });
  }
}

async function deleteProduct(req, res) {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'DELETE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: Number(req.params.id),
      details: `Deleted product ID ${req.params.id}`,
    });
    return res.json({ message: 'Product deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Cannot delete product because it is referenced by orders, BOM, or production.' });
  }
}

// ---------------- CUSTOMERS ----------------
async function listCustomers(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY id ASC');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load customers.' });
  }
}

async function createCustomer(req, res) {
  try {
    const { name, customer_type, contact_number, address, state, gstin = '' } = req.body;
    if (!name || !customer_type || !contact_number || !address || !state) {
      return res.status(400).json({ message: 'Name, customer type, contact, address, and state are required.' });
    }
    const [result] = await pool.query(
      `INSERT INTO customers (name, customer_type, contact_number, address, state, gstin)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), customer_type, contact_number.trim(), address.trim(), state.trim(), gstin.trim()]
    );
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: result.insertId,
      details: `Created customer ${name} (${state})`,
    });
    const [[created]] = await pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create customer.' });
  }
}

async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const { name, customer_type, contact_number, address, state, gstin = '' } = req.body;
    await pool.query(
      `UPDATE customers SET name = ?, customer_type = ?, contact_number = ?, address = ?, state = ?, gstin = ?
       WHERE id = ?`,
      [name.trim(), customer_type, contact_number.trim(), address.trim(), state.trim(), gstin.trim(), id]
    );
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: Number(id),
      details: `Updated customer ${name}`,
    });
    const [[updated]] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update customer.' });
  }
}

async function deleteCustomer(req, res) {
  try {
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Customer deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Cannot delete customer with existing orders or invoices.' });
  }
}

// ---------------- RAW MATERIALS ----------------
async function listRawMaterials(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM raw_materials ORDER BY id ASC');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load raw materials.' });
  }
}

async function createRawMaterial(req, res) {
  const conn = await pool.getConnection();
  try {
    const { name, unit, opening_stock = 0, purchase_rate = 0, reorder_level = 10 } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ message: 'Material name and unit are required.' });
    }
    const openQty = Number(opening_stock) || 0;
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO raw_materials (name, unit, opening_stock, purchase_rate, current_stock, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), unit.trim(), openQty, Number(purchase_rate) || 0, openQty, Number(reorder_level) || 10]
    );

    if (openQty > 0) {
      await conn.query(
        `INSERT INTO stock_ledger (item_category, raw_material_id, item_name, unit, transaction_date, transaction_type, source_document, qty_received, qty_issued, closing_balance, created_by)
         VALUES ('RAW_MATERIAL', ?, ?, ?, CURDATE(), 'OPENING', 'OPENING-BALANCE', ?, 0, ?, ?)`,
        [result.insertId, name.trim(), unit.trim(), openQty, openQty, req.user.id]
      );
    }

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_RAW_MATERIAL',
      entityType: 'RAW_MATERIAL',
      entityId: result.insertId,
      details: `Created raw material ${name} (${openQty} ${unit})`,
    });

    await conn.commit();
    const [[created]] = await pool.query('SELECT * FROM raw_materials WHERE id = ?', [result.insertId]);
    return res.status(201).json(created);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Raw material name already exists.' });
    }
    return res.status(500).json({ message: 'Failed to create raw material.' });
  } finally {
    conn.release();
  }
}

async function updateRawMaterial(req, res) {
  try {
    const { id } = req.params;
    const { name, unit, purchase_rate, reorder_level } = req.body;
    await pool.query(
      `UPDATE raw_materials SET name = ?, unit = ?, purchase_rate = ?, reorder_level = ? WHERE id = ?`,
      [name.trim(), unit.trim(), Number(purchase_rate), Number(reorder_level ?? 10), id]
    );
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_RAW_MATERIAL',
      entityType: 'RAW_MATERIAL',
      entityId: Number(id),
      details: `Updated raw material ${name}`,
    });
    const [[updated]] = await pool.query('SELECT * FROM raw_materials WHERE id = ?', [id]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update raw material.' });
  }
}

async function deleteRawMaterial(req, res) {
  try {
    await pool.query('DELETE FROM raw_materials WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Raw material deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Cannot delete raw material referenced in BOM, purchases, or production.' });
  }
}

// ---------------- PACKAGING MATERIALS ----------------
async function listPackagingMaterials(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM packaging_materials ORDER BY id ASC');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load packaging materials.' });
  }
}

async function createPackagingMaterial(req, res) {
  const conn = await pool.getConnection();
  try {
    const { name, unit, opening_stock = 0, purchase_rate = 0, reorder_level = 20 } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ message: 'Packaging material name and unit are required.' });
    }
    const openQty = Number(opening_stock) || 0;
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO packaging_materials (name, unit, opening_stock, purchase_rate, current_stock, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), unit.trim(), openQty, Number(purchase_rate) || 0, openQty, Number(reorder_level) || 20]
    );

    if (openQty > 0) {
      await conn.query(
        `INSERT INTO stock_ledger (item_category, packaging_material_id, item_name, unit, transaction_date, transaction_type, source_document, qty_received, qty_issued, closing_balance, created_by)
         VALUES ('PACKAGING', ?, ?, ?, CURDATE(), 'OPENING', 'OPENING-BALANCE', ?, 0, ?, ?)`,
        [result.insertId, name.trim(), unit.trim(), openQty, openQty, req.user.id]
      );
    }

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_PACKAGING',
      entityType: 'PACKAGING_MATERIAL',
      entityId: result.insertId,
      details: `Created packaging material ${name}`,
    });

    await conn.commit();
    const [[created]] = await pool.query('SELECT * FROM packaging_materials WHERE id = ?', [result.insertId]);
    return res.status(201).json(created);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Packaging material already exists.' });
    }
    return res.status(500).json({ message: 'Failed to create packaging material.' });
  } finally {
    conn.release();
  }
}

async function updatePackagingMaterial(req, res) {
  try {
    const { id } = req.params;
    const { name, unit, purchase_rate, reorder_level } = req.body;
    await pool.query(
      `UPDATE packaging_materials SET name = ?, unit = ?, purchase_rate = ?, reorder_level = ? WHERE id = ?`,
      [name.trim(), unit.trim(), Number(purchase_rate), Number(reorder_level ?? 20), id]
    );
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_PACKAGING',
      entityType: 'PACKAGING_MATERIAL',
      entityId: Number(id),
      details: `Updated packaging material ${name}`,
    });
    const [[updated]] = await pool.query('SELECT * FROM packaging_materials WHERE id = ?', [id]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update packaging material.' });
  }
}

async function deletePackagingMaterial(req, res) {
  try {
    await pool.query('DELETE FROM packaging_materials WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Packaging material deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Cannot delete packaging material referenced in BOM or production.' });
  }
}

// ---------------- SUPPLIERS ----------------
async function listSuppliers(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY id ASC');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load suppliers.' });
  }
}

async function createSupplier(req, res) {
  try {
    const { name, contact_number, address } = req.body;
    if (!name || !contact_number || !address) {
      return res.status(400).json({ message: 'Supplier name, contact number, and address are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_number, address) VALUES (?, ?, ?)',
      [name.trim(), contact_number.trim(), address.trim()]
    );
    await logAudit(pool, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_SUPPLIER',
      entityType: 'SUPPLIER',
      entityId: result.insertId,
      details: `Created supplier ${name}`,
    });
    const [[created]] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create supplier.' });
  }
}

async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const { name, contact_number, address } = req.body;
    await pool.query(
      'UPDATE suppliers SET name = ?, contact_number = ?, address = ? WHERE id = ?',
      [name.trim(), contact_number.trim(), address.trim(), id]
    );
    const [[updated]] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update supplier.' });
  }
}

async function deleteSupplier(req, res) {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Supplier deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Cannot delete supplier with existing purchases.' });
  }
}

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  listPackagingMaterials,
  createPackagingMaterial,
  updatePackagingMaterial,
  deletePackagingMaterial,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
