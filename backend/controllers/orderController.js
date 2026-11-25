const pool = require('../config/db');
const { round2, round3 } = require('../services/calculationService');
const { recordStockMovement } = require('../services/ledgerService');
const { logAudit } = require('../services/auditService');

async function generateOrderNumber(conn) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS count FROM orders');
  const nextSeq = Number(row.count) + 1;
  return `ORD-${String(nextSeq).padStart(4, '0')}`;
}

async function listOrders(req, res) {
  try {
    let whereClause = '';
    const params = [];
    if (req.user.role === 'salesman') {
      whereClause = 'WHERE o.salesman_id = ?';
      params.push(req.user.id);
    }

    const [orders] = await pool.query(
      `SELECT o.*,
              c.name AS customer_name, c.customer_type, c.state AS customer_state, c.gstin AS customer_gstin,
              u.name AS salesman_name,
              inv.id AS invoice_id, inv.invoice_number, inv.status AS invoice_status
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users u ON o.salesman_id = u.id
       LEFT JOIN invoices inv ON inv.order_id = o.id
       ${whereClause}
       ORDER BY o.id DESC`,
      params
    );

    const [items] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.product_code, p.hsn_code, p.current_stock AS available_stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       ORDER BY oi.id ASC`
    );

    const itemsByOrder = {};
    for (const item of items) {
      const shortage = item.available_stock < item.quantity
        ? round3(item.quantity - item.available_stock)
        : 0;
      const enriched = { ...item, shortage };
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(enriched);
    }

    const result = orders.map((o) => {
      const orderItems = itemsByOrder[o.id] || [];
      const totalShortage = orderItems.reduce((sum, it) => sum + Number(it.shortage || 0), 0);
      return {
        ...o,
        items: orderItems,
        has_shortage: totalShortage > 0 && o.status !== 'Dispatched' && o.status !== 'Rejected',
        total_shortage: round3(totalShortage),
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('listOrders error:', err);
    return res.status(500).json({ message: 'Failed to load orders.' });
  }
}

async function createOrder(req, res) {
  const conn = await pool.getConnection();
  try {
    const { customer_id, order_date, notes = '', items = [] } = req.body;
    if (!customer_id || items.length === 0) {
      return res.status(400).json({ message: 'Customer and at least one product item are required.' });
    }

    await conn.beginTransaction();
    const orderNumber = await generateOrderNumber(conn);
    const effectiveDate = order_date || new Date().toISOString().slice(0, 10);

    let totalAmount = 0;
    const preparedItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.product_id || qty <= 0) {
        throw new Error('Each order item must have a valid product and positive quantity.');
      }
      const [[product]] = await conn.query(
        'SELECT id, name, selling_price, gst_percentage FROM products WHERE id = ?',
        [item.product_id]
      );
      if (!product) {
        throw new Error(`Product ID ${item.product_id} not found.`);
      }
      const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(product.selling_price);
      const lineTotal = round2(qty * unitPrice);
      totalAmount = round2(totalAmount + lineTotal);

      preparedItems.push({
        product_id: product.id,
        quantity: round3(qty),
        unit_price: round2(unitPrice),
        gst_percentage: Number(product.gst_percentage),
        line_total: lineTotal,
      });
    }

    const [orderRes] = await conn.query(
      `INSERT INTO orders (order_number, customer_id, salesman_id, order_date, status, total_amount, notes)
       VALUES (?, ?, ?, ?, 'Submitted', ?, ?)`,
      [orderNumber, customer_id, req.user.id, effectiveDate, totalAmount, notes.trim()]
    );

    const orderId = orderRes.insertId;
    for (const pi of preparedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, gst_percentage, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, pi.product_id, pi.quantity, pi.unit_price, pi.gst_percentage, pi.line_total]
      );
    }

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_ORDER',
      entityType: 'ORDER',
      entityId: orderId,
      details: `Submitted order ${orderNumber} for customer ID ${customer_id}, total Rs.${totalAmount}`,
    });

    await conn.commit();
    return res.status(201).json({ id: orderId, order_number: orderNumber, total_amount: totalAmount, status: 'Submitted' });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ message: err.message || 'Failed to place order.' });
  } finally {
    conn.release();
  }
}

async function updateOrder(req, res) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { items = [], notes } = req.body;
    if (items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required.' });
    }

    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (order.status !== 'Submitted') {
      await conn.rollback();
      return res.status(400).json({ message: 'Only Submitted orders can be edited.' });
    }

    await conn.query('DELETE FROM order_items WHERE order_id = ?', [id]);
    let totalAmount = 0;

    for (const item of items) {
      const qty = round3(item.quantity);
      const unitPrice = round2(item.unit_price);
      if (qty <= 0 || unitPrice < 0) {
        throw new Error('Quantity must be > 0 and unit price >= 0.');
      }
      const [[product]] = await conn.query('SELECT gst_percentage FROM products WHERE id = ?', [item.product_id]);
      const lineTotal = round2(qty * unitPrice);
      totalAmount = round2(totalAmount + lineTotal);

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, gst_percentage, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.product_id, qty, unitPrice, product ? product.gst_percentage : 5.0, lineTotal]
      );
    }

    await conn.query('UPDATE orders SET total_amount = ?, notes = COALESCE(?, notes) WHERE id = ?', [
      totalAmount,
      notes !== undefined ? notes : null,
      id,
    ]);

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'EDIT_ORDER',
      entityType: 'ORDER',
      entityId: Number(id),
      details: `Edited order ${order.order_number}, updated total Rs.${totalAmount}`,
    });

    await conn.commit();
    return res.json({ message: 'Order updated successfully.', total_amount: totalAmount });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ message: err.message || 'Failed to update order.' });
  } finally {
    conn.release();
  }
}

async function updateOrderStatus(req, res) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }

    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (order.status !== 'Submitted') {
      await conn.rollback();
      return res.status(400).json({ message: `Cannot change status from ${order.status} to ${status}.` });
    }

    await conn.query(
      'UPDATE orders SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
      [status, req.user.id, id]
    );

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: status === 'Approved' ? 'APPROVE_ORDER' : 'REJECT_ORDER',
      entityType: 'ORDER',
      entityId: Number(id),
      details: `${status} order ${order.order_number}`,
    });

    await conn.commit();
    return res.json({ message: `Order ${status.toLowerCase()} successfully.`, status });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ message: 'Failed to update order status.' });
  } finally {
    conn.release();
  }
}

async function dispatchOrder(req, res) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const dispatchDate = req.body?.dispatch_date || new Date().toISOString().slice(0, 10);

    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.status === 'Dispatched') {
      await conn.rollback();
      return res.status(400).json({ message: 'Order is already dispatched.' });
    }

    if (!['Approved', 'Invoiced'].includes(order.status)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Order must be Approved or Invoiced before dispatch.' });
    }

    const [[invoice]] = await conn.query(
      "SELECT id, invoice_number FROM invoices WHERE order_id = ? AND status = 'ACTIVE' LIMIT 1",
      [id]
    );

    const [items] = await conn.query(
      `SELECT oi.*, p.name AS product_name, p.current_stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    // Check finished goods stock availability for all items before deducting
    const shortages = [];
    for (const item of items) {
      const available = Number(item.current_stock);
      const required = Number(item.quantity);
      if (available < required) {
        shortages.push({
          product_id: item.product_id,
          product_name: item.product_name,
          available,
          required,
          shortage: round3(required - available),
        });
      }
    }

    if (shortages.length > 0) {
      await conn.rollback();
      const first = shortages[0];
      return res.status(400).json({
        message: `Insufficient finished-goods stock for ${first.product_name}. Available: ${first.available}, Required: ${first.required}, Shortage: ${first.shortage} packets.`,
        shortages,
      });
    }

    const sourceDoc = invoice ? invoice.invoice_number : order.order_number;

    for (const item of items) {
      await recordStockMovement(conn, {
        itemCategory: 'FINISHED_GOOD',
        itemId: item.product_id,
        transactionDate: dispatchDate,
        transactionType: 'DISPATCH',
        sourceDocument: sourceDoc,
        sourceId: Number(id),
        qtyReceived: 0,
        qtyIssued: item.quantity,
        userId: req.user.id,
      });
    }

    await conn.query(
      "UPDATE orders SET status = 'Dispatched', dispatched_by = ?, dispatched_at = NOW() WHERE id = ?",
      [req.user.id, id]
    );

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'DISPATCH_ORDER',
      entityType: 'ORDER',
      entityId: Number(id),
      details: `Dispatched order ${order.order_number} (Source: ${sourceDoc})`,
    });

    await conn.commit();
    return res.json({ message: 'Order dispatched and finished-goods stock updated.', status: 'Dispatched' });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ message: err.message || 'Failed to dispatch order.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listOrders,
  createOrder,
  updateOrder,
  updateOrderStatus,
  dispatchOrder,
};
