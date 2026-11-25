import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [outstandingList, setOutstandingList] = useState([]);

  const [invoiceId, setInvoiceId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [invRes, payRes, outRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/payments'),
        api.get('/payments/outstanding'),
      ]);
      const payable = invRes.data.filter((i) => i.status === 'ACTIVE' && Number(i.outstanding_amount) > 0);
      setInvoices(payable);
      setPayments(payRes.data);
      setOutstandingList(outRes.data);
      if (payable.length > 0 && !invoiceId) {
        setInvoiceId(String(payable[0].id));
      }
    } catch {
      setError('Failed to load payments data.');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedInv = invoices.find((i) => String(i.id) === String(invoiceId));

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.post('/payments', {
        invoice_id: Number(invoiceId),
        payment_date: paymentDate,
        amount: Number(amount),
        payment_mode: paymentMode,
        reference_number: referenceNumber,
        notes,
      });
      setMessage(`Payment ${res.data.payment_number} recorded. Remaining invoice balance: ₹${Number(res.data.outstanding_amount).toFixed(2)}`);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setInvoiceId('');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment.');
    }
  }

  return (
    <AppLayout title="Payments & Customer Outstanding">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="card-title">Record Customer Payment</h3>
        {invoices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No unpaid active invoices pending.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Invoice</label>
                <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
                  <option value="">Select Invoice</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name} (Due: ₹{Number(inv.outstanding_amount).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Payment Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Amount Received (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedInv ? Number(selectedInv.outstanding_amount) : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label>Reference No</label>
                <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="UTR / Ref No" />
              </div>
            </div>
            {selectedInv && (
              <p style={{ fontSize: 13, color: 'var(--primary-dark)', marginTop: 0 }}>
                Invoice Total: ₹{Number(selectedInv.grand_total).toFixed(2)} | Paid: ₹{Number(selectedInv.paid_amount).toFixed(2)} | Outstanding: <strong>₹{Number(selectedInv.outstanding_amount).toFixed(2)}</strong>
              </p>
            )}
            <button type="submit" className="btn btn-primary">Record Payment</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Customer-wise Outstanding Balances</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Customer</th><th>Type</th><th>State</th><th>Total Invoiced</th><th>Total Paid</th><th>Outstanding Balance</th></tr>
            </thead>
            <tbody>
              {outstandingList.map((c) => (
                <tr key={c.customer_id}>
                  <td><strong>{c.customer_name}</strong></td>
                  <td>{c.customer_type}</td>
                  <td>{c.state}</td>
                  <td>₹{Number(c.total_invoiced).toFixed(2)}</td>
                  <td>₹{Number(c.total_paid).toFixed(2)}</td>
                  <td>
                    <strong style={{ color: Number(c.outstanding_balance) > 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                      ₹{Number(c.outstanding_balance).toFixed(2)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Payment Collection History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Payment No</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Amount</th><th>Mode</th><th>Ref</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.payment_number}</strong></td>
                  <td>{p.payment_date}</td>
                  <td>{p.customer_name}</td>
                  <td>{p.invoice_number}</td>
                  <td><strong>₹{Number(p.amount).toFixed(2)}</strong></td>
                  <td>{p.payment_mode}</td>
                  <td>{p.reference_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
