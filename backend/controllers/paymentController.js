const pool = require('../config/db');
const { round2 } = require('../services/calculationService');
const { logAudit } = require('../services/auditService');

async function listPayments(req, res) {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, inv.invoice_number, inv.grand_total AS invoice_total,
              c.name AS customer_name, u.name AS recorded_by_name
       FROM payments p
       JOIN invoices inv ON p.invoice_id = inv.id
       JOIN customers c ON p.customer_id = c.id
       LEFT JOIN users u ON p.recorded_by = u.id
       ORDER BY p.id DESC`
    );
    return res.json(payments);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load payments.' });
  }
}

async function getCustomerOutstanding(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id AS customer_id, c.name AS customer_name, c.customer_type, c.state,
              COALESCE(SUM(CASE WHEN inv.status = 'ACTIVE' THEN inv.grand_total ELSE 0 END), 0) AS total_invoiced,
              COALESCE((
                SELECT SUM(p.amount)
                FROM payments p
                JOIN invoices inv2 ON p.invoice_id = inv2.id
                WHERE p.customer_id = c.id AND inv2.status = 'ACTIVE'
              ), 0) AS total_paid
       FROM customers c
       LEFT JOIN invoices inv ON inv.customer_id = c.id
       GROUP BY c.id
       ORDER BY c.name ASC`
    );

    const formatted = rows.map((r) => {
      const invoiced = Number(r.total_invoiced || 0);
      const paid = Number(r.total_paid || 0);
      return {
        ...r,
        total_invoiced: round2(invoiced),
        total_paid: round2(paid),
        outstanding_balance: round2(invoiced - paid),
      };
    });

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load customer outstanding balances.' });
  }
}

async function createPayment(req, res) {
  const conn = await pool.getConnection();
  try {
    const { invoice_id, payment_date, amount, payment_mode = 'Bank Transfer', reference_number = '', notes = '' } = req.body;
    const payAmt = round2(amount);

    if (!invoice_id || payAmt <= 0) {
      return res.status(400).json({ message: 'Invoice and positive payment amount are required.' });
    }

    await conn.beginTransaction();

    const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoice_id]);
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    if (invoice.status !== 'ACTIVE') {
      await conn.rollback();
      return res.status(400).json({ message: 'Cannot record payment for a cancelled invoice.' });
    }

    const [[paidRow]] = await conn.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ?',
      [invoice_id]
    );
    const alreadyPaid = Number(paidRow.paid || 0);
    const outstanding = round2(Number(invoice.grand_total) - alreadyPaid);

    if (payAmt > outstanding) {
      await conn.rollback();
      return res.status(400).json({
        message: `Payment amount (Rs.${payAmt}) exceeds outstanding balance (Rs.${outstanding}).`,
      });
    }

    const [[cnt]] = await conn.query('SELECT COUNT(*) AS count FROM payments');
    const paymentNumber = `PAY-${String(Number(cnt.count) + 1).padStart(4, '0')}`;
    const effectiveDate = payment_date || new Date().toISOString().slice(0, 10);

    const [payRes] = await conn.query(
      `INSERT INTO payments (payment_number, invoice_id, customer_id, payment_date, amount, payment_mode, reference_number, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentNumber, invoice_id, invoice.customer_id, effectiveDate, payAmt, payment_mode, reference_number.trim(), notes.trim(), req.user.id]
    );

    const newOutstanding = round2(outstanding - payAmt);

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'RECORD_PAYMENT',
      entityType: 'PAYMENT',
      entityId: payRes.insertId,
      details: `Recorded payment ${paymentNumber} of Rs.${payAmt} against ${invoice.invoice_number}. Remaining outstanding: Rs.${newOutstanding}`,
    });

    await conn.commit();
    return res.status(201).json({
      id: payRes.insertId,
      payment_number: paymentNumber,
      amount: payAmt,
      outstanding_amount: newOutstanding,
      message: 'Payment recorded successfully.',
    });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ message: err.message || 'Failed to record payment.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listPayments,
  getCustomerOutstanding,
  createPayment,
};
