const { round3 } = require('./calculationService');

/**
 * Records a stock movement inside an active MySQL transaction and updates the
 * corresponding item's current_stock atomically.
 * Never overwrites stock directly without inserting an immutable stock_ledger row.
 */
async function recordStockMovement(conn, {
  itemCategory, // 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOOD'
  itemId,
  transactionDate,
  transactionType, // 'OPENING' | 'PURCHASE' | 'PRODUCTION_ISSUE' | 'PRODUCTION_OUTPUT' | 'DISPATCH' | 'ADJUSTMENT'
  sourceDocument,
  sourceId = null,
  qtyReceived = 0,
  qtyIssued = 0,
  userId = null,
  allowNegative = false,
}) {
  const received = round3(qtyReceived);
  const issued = round3(qtyIssued);

  let tableName;
  let ledgerCol;
  if (itemCategory === 'RAW_MATERIAL') {
    tableName = 'raw_materials';
    ledgerCol = 'raw_material_id';
  } else if (itemCategory === 'PACKAGING') {
    tableName = 'packaging_materials';
    ledgerCol = 'packaging_material_id';
  } else if (itemCategory === 'FINISHED_GOOD') {
    tableName = 'products';
    ledgerCol = 'product_id';
  } else {
    throw new Error(`Invalid stock item category: ${itemCategory}`);
  }

  // Lock the row for update inside the transaction
  const [rows] = await conn.query(
    `SELECT id, name, current_stock${itemCategory === 'FINISHED_GOOD' ? '' : ', unit'} FROM ${tableName} WHERE id = ? FOR UPDATE`,
    [itemId]
  );

  if (rows.length === 0) {
    throw new Error(`${itemCategory} with ID ${itemId} not found.`);
  }

  const item = rows[0];
  const unit = itemCategory === 'FINISHED_GOOD' ? 'packets' : item.unit;
  const currentBalance = Number(item.current_stock);
  const newBalance = round3(currentBalance + received - issued);

  if (!allowNegative && newBalance < 0) {
    throw new Error(
      `Insufficient stock for ${item.name}. Available: ${currentBalance} ${unit}, Required: ${issued} ${unit}.`
    );
  }

  await conn.query(`UPDATE ${tableName} SET current_stock = ? WHERE id = ?`, [newBalance, itemId]);

  await conn.query(
    `INSERT INTO stock_ledger (
      item_category, ${ledgerCol}, item_name, unit, transaction_date,
      transaction_type, source_document, source_id, qty_received, qty_issued, closing_balance, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      itemCategory,
      itemId,
      item.name,
      unit,
      transactionDate,
      transactionType,
      sourceDocument,
      sourceId,
      received,
      issued,
      newBalance,
      userId,
    ]
  );

  return {
    itemName: item.name,
    unit,
    previousBalance: currentBalance,
    closingBalance: newBalance,
  };
}

module.exports = {
  recordStockMovement,
};
