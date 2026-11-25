const pool = require('../config/db');
const { logAudit } = require('../services/auditService');

async function getAllBoms(req, res) {
  try {
    const [boms] = await pool.query(
      `SELECT b.*, p.name AS product_name, p.product_code, p.pack_size, p.selling_price
       FROM bom b
       JOIN products p ON b.product_id = p.id
       ORDER BY b.id ASC`
    );

    const [items] = await pool.query(
      `SELECT bi.*,
              COALESCE(rm.name, pm.name) AS material_name,
              COALESCE(rm.current_stock, pm.current_stock) AS current_stock,
              COALESCE(rm.purchase_rate, pm.purchase_rate) AS purchase_rate
       FROM bom_items bi
       LEFT JOIN raw_materials rm ON bi.raw_material_id = rm.id
       LEFT JOIN packaging_materials pm ON bi.packaging_material_id = pm.id
       ORDER BY bi.item_type ASC, bi.id ASC`
    );

    const itemsByBom = {};
    for (const item of items) {
      if (!itemsByBom[item.bom_id]) itemsByBom[item.bom_id] = [];
      itemsByBom[item.bom_id].push(item);
    }

    const result = boms.map((b) => ({
      ...b,
      items: itemsByBom[b.id] || [],
    }));

    return res.json(result);
  } catch (err) {
    console.error('getAllBoms error:', err);
    return res.status(500).json({ message: 'Failed to load Bills of Materials.' });
  }
}

async function getBomByProduct(req, res) {
  try {
    const { productId } = req.params;
    const [boms] = await pool.query(
      `SELECT b.*, p.name AS product_name, p.product_code, p.pack_size, p.selling_price
       FROM bom b
       JOIN products p ON b.product_id = p.id
       WHERE b.product_id = ? LIMIT 1`,
      [productId]
    );

    if (boms.length === 0) {
      return res.status(404).json({ message: 'No BOM found for this product.' });
    }

    const bom = boms[0];
    const [items] = await pool.query(
      `SELECT bi.*,
              COALESCE(rm.name, pm.name) AS material_name,
              COALESCE(rm.current_stock, pm.current_stock) AS current_stock,
              COALESCE(rm.purchase_rate, pm.purchase_rate) AS purchase_rate
       FROM bom_items bi
       LEFT JOIN raw_materials rm ON bi.raw_material_id = rm.id
       LEFT JOIN packaging_materials pm ON bi.packaging_material_id = pm.id
       WHERE bi.bom_id = ?
       ORDER BY bi.item_type ASC, bi.id ASC`,
      [bom.id]
    );

    return res.json({ ...bom, items });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load BOM.' });
  }
}

async function upsertBom(req, res) {
  const conn = await pool.getConnection();
  try {
    const { product_id, batch_name = 'Standard Batch', expected_output, notes = '', items = [] } = req.body;
    if (!product_id || !expected_output || items.length === 0) {
      return res.status(400).json({ message: 'Product, expected output, and at least one BOM item are required.' });
    }

    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM bom WHERE product_id = ?', [product_id]);
    let bomId;

    if (existing.length > 0) {
      bomId = existing[0].id;
      await conn.query(
        'UPDATE bom SET batch_name = ?, expected_output = ?, notes = ? WHERE id = ?',
        [batch_name.trim(), Number(expected_output), notes.trim(), bomId]
      );
      await conn.query('DELETE FROM bom_items WHERE bom_id = ?', [bomId]);
    } else {
      const [inserted] = await conn.query(
        'INSERT INTO bom (product_id, batch_name, expected_output, notes, created_by) VALUES (?, ?, ?, ?, ?)',
        [product_id, batch_name.trim(), Number(expected_output), notes.trim(), req.user.id]
      );
      bomId = inserted.insertId;
    }

    for (const item of items) {
      const itemType = item.item_type;
      const rawId = itemType === 'RAW_MATERIAL' ? Number(item.material_id || item.raw_material_id) : null;
      const pkgId = itemType === 'PACKAGING' ? Number(item.material_id || item.packaging_material_id) : null;

      let unit = item.unit;
      if (!unit && rawId) {
        const [[rm]] = await conn.query('SELECT unit FROM raw_materials WHERE id = ?', [rawId]);
        unit = rm ? rm.unit : 'kg';
      }
      if (!unit && pkgId) {
        const [[pm]] = await conn.query('SELECT unit FROM packaging_materials WHERE id = ?', [pkgId]);
        unit = pm ? pm.unit : 'pieces';
      }

      await conn.query(
        `INSERT INTO bom_items (bom_id, item_type, raw_material_id, packaging_material_id, standard_quantity, unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bomId, itemType, rawId, pkgId, Number(item.standard_quantity), unit]
      );
    }

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: existing.length > 0 ? 'UPDATE_BOM' : 'CREATE_BOM',
      entityType: 'BOM',
      entityId: bomId,
      details: `Saved BOM for product ID ${product_id} (Expected output: ${expected_output})`,
    });

    await conn.commit();
    return res.status(200).json({ id: bomId, message: 'BOM saved successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('upsertBom error:', err);
    return res.status(500).json({ message: 'Failed to save BOM.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  getAllBoms,
  getBomByProduct,
  upsertBom,
};
