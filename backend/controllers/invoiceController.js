const pool = require('../config/db');
const company = require('../config/company');
const { round2, calculateGstBreakdown, getFinancialYear } = require('../services/calculationService');
const { logAudit } = require('../services/auditService');

async function generateInvoiceNumber(conn, financialYear) {
  const [[row]] = await conn.query(
    'SELECT COUNT(*) AS count FROM invoices WHERE financial_year = ?',
    [financialYear]
  );
  const seq = Number(row.count) + 1;
  return `INV/${financialYear}/${String(seq).padStart(4, '0')}`;
}

async function listInvoices(req, res) {
  try {
    const [invoices] = await pool.query(
      `SELECT inv.*,
              c.name AS customer_name, c.customer_type, c.address AS customer_address,
              c.contact_number AS customer_contact, c.gstin AS customer_gstin,
              o.order_number, o.status AS order_status,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = inv.id), 0) AS paid_amount
       FROM invoices inv
       JOIN customers c ON inv.customer_id = c.id
       JOIN orders o ON inv.order_id = o.id
       ORDER BY inv.id DESC`
    );

    const [items] = await pool.query('SELECT * FROM invoice_items ORDER BY id ASC');
    const byInvoice = {};
    for (const item of items) {
      if (!byInvoice[item.invoice_id]) byInvoice[item.invoice_id] = [];
      byInvoice[item.invoice_id].push(item);
    }

    const result = invoices.map((inv) => {
      const paid = Number(inv.paid_amount || 0);
      const grand = Number(inv.grand_total || 0);
      const outstanding = inv.status === 'CANCELLED' ? 0 : round2(grand - paid);
      return {
        ...inv,
        company_name: company.name,
        company_gstin: company.gstin,
        company_address: company.address,
        company_state: company.state,
        paid_amount: paid,
        outstanding_amount: outstanding,
        items: byInvoice[inv.id] || [],
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('listInvoices error:', err);
    return res.status(500).json({ message: 'Failed to load invoices.' });
  }
}

async function createInvoiceFromOrder(req, res) {
  const conn = await pool.getConnection();
  try {
    const { orderId } = req.params;
    const invoiceDate = req.body?.invoice_date || new Date().toISOString().slice(0, 10);

    await conn.beginTransaction();

    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.status !== 'Approved') {
      await conn.rollback();
      return res.status(400).json({
        message: `Order must be Approved before generating an invoice (current status: ${order.status}).`,
      });
    }

    const [existingInv] = await conn.query(
      "SELECT id FROM invoices WHERE order_id = ? AND status = 'ACTIVE'",
      [orderId]
    );
    if (existingInv.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'An active invoice already exists for this order.' });
    }

    const [[customer]] = await conn.query('SELECT * FROM customers WHERE id = ?', [order.customer_id]);
    const [orderItems] = await conn.query(
      `SELECT oi.*, p.name AS product_name, p.hsn_code, p.current_stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // Verify finished-goods stock availability before generating invoice
    const shortages = [];
    for (const item of orderItems) {
      const available = Number(item.current_stock);
      const required = Number(item.quantity);
      if (available < required) {
        shortages.push({
          product_id: item.product_id,
          product_name: item.product_name,
          available,
          required,
          shortage: Number((required - available).toFixed(3)),
        });
      }
    }

    if (shortages.length > 0) {
      await conn.rollback();
      const first = shortages[0];
      return res.status(400).json({
        message: `Insufficient stock for ${first.product_name}. Available: ${first.available}, Required: ${first.required}, Shortage: ${first.shortage} packets. Order kept pending until stock is available.`,
        shortages,
      });
    }

    const financialYear = getFinancialYear(invoiceDate);
    const invoiceNumber = await generateInvoiceNumber(conn, financialYear);

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;
    let invoiceTaxType = 'CGST_SGST';

    const preparedItems = [];
    for (const item of orderItems) {
      const lineTaxable = round2(Number(item.quantity) * Number(item.unit_price));
      const gst = calculateGstBreakdown({
        supplierState: company.state,
        customerState: customer.state,
        taxableAmount: lineTaxable,
        gstPercentage: item.gst_percentage,
      });

      invoiceTaxType = gst.taxType;
      totalTaxable = round2(totalTaxable + gst.taxableAmount);
      totalCgst = round2(totalCgst + gst.cgstAmount);
      totalSgst = round2(totalSgst + gst.sgstAmount);
      totalIgst = round2(totalIgst + gst.igstAmount);
      grandTotal = round2(grandTotal + gst.grandTotal);

      preparedItems.push({
        product_id: item.product_id,
        product_name: item.product_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_percentage: item.gst_percentage,
        taxable_amount: gst.taxableAmount,
        cgst_amount: gst.cgstAmount,
        sgst_amount: gst.sgstAmount,
        igst_amount: gst.igstAmount,
        line_total: gst.grandTotal,
      });
    }

    const [invRes] = await conn.query(
      `INSERT INTO invoices (
        invoice_number, financial_year, order_id, customer_id, invoice_date,
        supplier_state, customer_state, tax_type, taxable_amount,
        cgst_amount, sgst_amount, igst_amount, grand_total, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        financialYear,
        orderId,
        customer.id,
        invoiceDate,
        company.state,
        customer.state,
        invoiceTaxType,
        totalTaxable,
        totalCgst,
        totalSgst,
        totalIgst,
        grandTotal,
        req.user.id,
      ]
    );

    const invoiceId = invRes.insertId;
    for (const pi of preparedItems) {
      await conn.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, product_name, hsn_code, quantity, unit_price,
          gst_percentage, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          pi.product_id,
          pi.product_name,
          pi.hsn_code,
          pi.quantity,
          pi.unit_price,
          pi.gst_percentage,
          pi.taxable_amount,
          pi.cgst_amount,
          pi.sgst_amount,
          pi.igst_amount,
          pi.line_total,
        ]
      );
    }

    await conn.query("UPDATE orders SET status = 'Invoiced' WHERE id = ?", [orderId]);

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_INVOICE',
      entityType: 'INVOICE',
      entityId: invoiceId,
      details: `Generated GST invoice ${invoiceNumber} for order ${order.order_number}, grand total Rs.${grandTotal}`,
    });

    await conn.commit();

    return res.status(201).json({
      id: invoiceId,
      invoice_number: invoiceNumber,
      tax_type: invoiceTaxType,
      taxable_amount: totalTaxable,
      cgst_amount: totalCgst,
      sgst_amount: totalSgst,
      igst_amount: totalIgst,
      grand_total: grandTotal,
      message: 'GST Invoice generated successfully.',
    });
  } catch (err) {
    await conn.rollback();
    console.error('createInvoiceFromOrder error:', err);
    return res.status(400).json({ message: err.message || 'Failed to generate invoice.' });
  } finally {
    conn.release();
  }
}

async function cancelInvoice(req, res) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Cancellation / credit-note reason is required.' });
    }

    await conn.beginTransaction();
    const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [id]);
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    if (invoice.status === 'CANCELLED') {
      await conn.rollback();
      return res.status(400).json({ message: 'Invoice is already cancelled.' });
    }

    const [[cnRow]] = await conn.query(
      'SELECT COUNT(*) AS count FROM invoices WHERE credit_note_number IS NOT NULL'
    );
    const creditNoteNumber = `CN/${invoice.financial_year}/${String(Number(cnRow.count) + 1).padStart(4, '0')}`;

    await conn.query(
      `UPDATE invoices
       SET status = 'CANCELLED', credit_note_number = ?, cancellation_reason = ?, cancelled_by = ?, cancelled_at = NOW()
       WHERE id = ?`,
      [creditNoteNumber, reason.trim(), req.user.id, id]
    );

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CANCEL_INVOICE_CREDIT_NOTE',
      entityType: 'INVOICE',
      entityId: Number(id),
      details: `Cancelled invoice ${invoice.invoice_number} via Credit Note ${creditNoteNumber}: ${reason.trim()}`,
    });

    await conn.commit();
    return res.json({
      message: `Invoice cancelled with Credit Note ${creditNoteNumber}.`,
      credit_note_number: creditNoteNumber,
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ message: 'Failed to cancel invoice.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listInvoices,
  createInvoiceFromOrder,
  cancelInvoice,
};
