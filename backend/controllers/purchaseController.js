const pool = require('../config/db');
const { round2, round3, calculateWeightedAverageRate } = require('../services/calculationService');
const { recordStockMovement } = require('../services/ledgerService');
const { logAudit } = require('../services/auditService');

async function listPurchases(req, res) {
  try {
    const [purchases] = await pool.query(
      `SELECT pu.*, s.name AS supplier_name, u.name AS created_by_name
       FROM purchases pu
       JOIN suppliers s ON pu.supplier_id = s.id
       LEFT JOIN users u ON pu.created_by = u.id
       ORDER BY pu.id DESC`
    );

    const [items] = await pool.query(
      `SELECT pi.*, COALESCE(rm.name, pm.name) AS material_name
       FROM purchase_items pi
       LEFT JOIN raw_materials rm ON pi.raw_material_id = rm.id
       LEFT JOIN packaging_materials pm ON pi.packaging_material_id = pm.id
       ORDER BY pi.id ASC`
    );

    const byPurchase = {};
    for (const item of items) {
      if (!byPurchase[item.purchase_id]) byPurchase[item.purchase_id] = [];
      byPurchase[item.purchase_id].push(item);
    }

    return res.json(
      purchases.map((p) => ({
        ...p,
        items: byPurchase[p.id] || [],
      }))
    );
  } catch (err) {
    console.error('listPurchases error:', err);
    return res.status(500).json({ message: 'Failed to load purchases.' });
  }
}

async function createPurchase(req, res) {
  const conn = await pool.getConnection();
  try {
    const { supplier_id, purchase_date, notes = '', items = [] } = req.body;
    if (!supplier_id || items.length === 0) {
      return res.status(400).json({ message: 'Supplier and at least one purchase item are required.' });
    }

    await conn.beginTransaction();
    const [[countRow]] = await conn.query('SELECT COUNT(*) AS count FROM purchases');
    const purchaseNumber = `PUR-${String(Number(countRow.count) + 1).padStart(4, '0')}`;
    const effectiveDate = purchase_date || new Date().toISOString().slice(0, 10);

    const [purchaseRes] = await conn.query(
      `INSERT INTO purchases (purchase_number, supplier_id, purchase_date, total_amount, notes, created_by)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [purchaseNumber, supplier_id, effectiveDate, notes.trim(), req.user.id]
    );
    const purchaseId = purchaseRes.insertId;

    let grandTotal = 0;

    for (const item of items) {
      const itemType = item.item_type || 'RAW_MATERIAL';
      const materialId = Number(item.material_id || item.raw_material_id || item.packaging_material_id);
      const qty = round3(item.quantity);
      const rate = Number(item.rate);

      if (!materialId || qty <= 0 || rate < 0) {
        throw new Error('Each purchase item needs a valid material, positive quantity, and valid rate.');
      }

      const tableName = itemType === 'RAW_MATERIAL' ? 'raw_materials' : 'packaging_materials';
      const [[mat]] = await conn.query(
        `SELECT id, name, unit, current_stock, purchase_rate FROM ${tableName} WHERE id = ? FOR UPDATE`,
        [materialId]
      );
      if (!mat) {
        throw new Error(`${itemType} ID ${materialId} not found.`);
      }

      // Weighted-average valuation rate update
      const newWeightedRate = calculateWeightedAverageRate(
        mat.current_stock,
        mat.purchase_rate,
        qty,
        rate
      );

      await conn.query(`UPDATE ${tableName} SET purchase_rate = ? WHERE id = ?`, [newWeightedRate, materialId]);

      const lineTotal = round2(qty * rate);
      grandTotal = round2(grandTotal + lineTotal);

      await conn.query(
        `INSERT INTO purchase_items (purchase_id, item_type, raw_material_id, packaging_material_id, quantity, unit, rate, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          itemType,
          itemType === 'RAW_MATERIAL' ? materialId : null,
          itemType === 'PACKAGING' ? materialId : null,
          qty,
          mat.unit,
          rate,
          lineTotal,
        ]
      );

      await recordStockMovement(conn, {
        itemCategory: itemType,
        itemId: materialId,
        transactionDate: effectiveDate,
        transactionType: 'PURCHASE',
        sourceDocument: purchaseNumber,
        sourceId: purchaseId,
        qtyReceived: qty,
        qtyIssued: 0,
        userId: req.user.id,
      });
    }

    await conn.query('UPDATE purchases SET total_amount = ? WHERE id = ?', [grandTotal, purchaseId]);

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_PURCHASE',
      entityType: 'PURCHASE',
      entityId: purchaseId,
      details: `Recorded purchase ${purchaseNumber} totaling Rs.${grandTotal}`,
    });

    await conn.commit();
    return res.status(201).json({
      id: purchaseId,
      purchase_number: purchaseNumber,
      total_amount: grandTotal,
      message: 'Purchase recorded and stock updated successfully.',
    });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ message: err.message || 'Failed to record purchase.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listPurchases,
  createPurchase,
};
