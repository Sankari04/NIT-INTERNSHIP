import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { downloadGstInvoicePdf } from '../services/exportUtils';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadInvoices() {
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data);
    } catch {
      setError('Failed to load invoices.');
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function handleCancelInvoice(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.post(`/invoices/${cancelTarget.id}/cancel`, { reason: cancelReason });
      setMessage(res.data.message);
      setCancelTarget(null);
      setCancelReason('');
      loadInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel invoice.');
    }
  }

  return (
    <AppLayout title="GST Invoices">
      <div className="alert alert-warning">
        Prototype GST Module: Uses dummy company/GST details (5% GST — Tamil Nadu: 2.5% CGST + 2.5% SGST; Inter-state: 5% IGST). Not certified for statutory GST filing. Posted invoices cannot be deleted; use Credit Note cancellation instead.
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {cancelTarget && (
        <div className="card">
          <h3 className="card-title">Cancel Invoice {cancelTarget.invoice_number} (Issue Credit Note)</h3>
          <form onSubmit={handleCancelInvoice}>
            <div className="form-group">
              <label>Cancellation / Credit Note Reason</label>
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
            </div>
            <div className="btn-row">
              <button type="submit" className="btn btn-danger">Confirm Cancellation &amp; Credit Note</button>
              <button type="button" className="btn btn-secondary" onClick={() => setCancelTarget(null)}>Close</button>
            </div>
          </form>
        </div>
      )}

      {selectedInvoice && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 className="card-title" style={{ margin: 0 }}>Invoice Preview: {selectedInvoice.invoice_number}</h3>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadGstInvoicePdf(selectedInvoice)}>
                Download PDF
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedInvoice(null)}>
                Close Preview
              </button>
            </div>
          </div>
          <p style={{ margin: '4px 0' }}>
            <strong>Seller:</strong> {selectedInvoice.company_name} ({selectedInvoice.company_state}) | GSTIN: {selectedInvoice.company_gstin}
          </p>
          <p style={{ margin: '4px 0 12px' }}>
            <strong>Buyer:</strong> {selectedInvoice.customer_name} ({selectedInvoice.customer_state}) | GSTIN: {selectedInvoice.customer_gstin || 'N/A'}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th><th>HSN</th><th>Qty</th><th>Unit Price</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.product_name}</td>
                    <td>{it.hsn_code}</td>
                    <td>{Number(it.quantity)}</td>
                    <td>₹{Number(it.unit_price).toFixed(2)}</td>
                    <td>₹{Number(it.taxable_amount).toFixed(2)}</td>
                    <td>₹{Number(it.cgst_amount).toFixed(2)}</td>
                    <td>₹{Number(it.sgst_amount).toFixed(2)}</td>
                    <td>₹{Number(it.igst_amount).toFixed(2)}</td>
                    <td><strong>₹{Number(it.line_total).toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Generated GST Invoices</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Taxable</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
                <th>Grand Total</th>
                <th>Paid / Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.invoice_number}</strong>
                    {inv.credit_note_number && (
                      <div style={{ fontSize: 11, color: 'var(--danger-text)' }}>CN: {inv.credit_note_number}</div>
                    )}
                  </td>
                  <td>{inv.invoice_date}</td>
                  <td>{inv.order_number}</td>
                  <td>{inv.customer_name} ({inv.customer_state})</td>
                  <td>₹{Number(inv.taxable_amount).toFixed(2)}</td>
                  <td>₹{Number(inv.cgst_amount).toFixed(2)}</td>
                  <td>₹{Number(inv.sgst_amount).toFixed(2)}</td>
                  <td>₹{Number(inv.igst_amount).toFixed(2)}</td>
                  <td><strong>₹{Number(inv.grand_total).toFixed(2)}</strong></td>
                  <td>
                    Paid: ₹{Number(inv.paid_amount).toFixed(2)}
                    <div style={{ fontSize: 11, color: Number(inv.outstanding_amount) > 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                      Due: ₹{Number(inv.outstanding_amount).toFixed(2)}
                    </div>
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td>
                    <div className="btn-row">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedInvoice(inv)}>
                        View
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadGstInvoicePdf(inv)}>
                        PDF
                      </button>
                      {inv.status === 'ACTIVE' && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setCancelTarget(inv)}>
                          Cancel / CN
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
