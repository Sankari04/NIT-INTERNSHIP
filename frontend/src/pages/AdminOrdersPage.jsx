import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadOrders() {
    try {
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (err) {
      setError('Failed to load sales orders.');
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function handleStatus(orderId, status) {
    setMessage('');
    setError('');
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setMessage(`Order ${status.toLowerCase()} successfully.`);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Status update failed.');
    }
  }

  async function handleGenerateInvoice(orderId) {
    setMessage('');
    setError('');
    try {
      const res = await api.post(`/invoices/from-order/${orderId}`, {});
      setMessage(`Invoice ${res.data.invoice_number} generated (Grand Total: ₹${Number(res.data.grand_total).toFixed(2)}).`);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice generation failed.');
    }
  }

  async function handleDispatch(orderId) {
    setMessage('');
    setError('');
    try {
      await api.post(`/orders/${orderId}/dispatch`, {});
      setMessage('Order dispatched and finished-goods stock deducted.');
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Dispatch failed.');
    }
  }

  function startEdit(order) {
    setEditingOrder(order);
    setEditItems(
      order.items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
      }))
    );
  }

  async function saveEdit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.put(`/orders/${editingOrder.id}`, { items: editItems });
      setMessage(`Order ${editingOrder.order_number} updated.`);
      setEditingOrder(null);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to edit order.');
    }
  }

  return (
    <AppLayout title="Sales Orders, Approval & Dispatch">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {editingOrder && (
        <div className="card">
          <h3 className="card-title">Edit Order {editingOrder.order_number} ({editingOrder.customer_name})</h3>
          <form onSubmit={saveEdit}>
            {editItems.map((it, idx) => (
              <div key={idx} className="form-grid" style={{ marginBottom: 8 }}>
                <div className="form-group">
                  <label>Product</label>
                  <input value={it.product_name} disabled />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={it.quantity}
                    onChange={(e) => {
                      const next = [...editItems];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setEditItems(next);
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={it.unit_price}
                    onChange={(e) => {
                      const next = [...editItems];
                      next[idx] = { ...next[idx], unit_price: e.target.value };
                      setEditItems(next);
                    }}
                    required
                  />
                </div>
              </div>
            ))}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary">Save Order Changes</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">All Sales Orders</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Salesman</th>
                <th>Items &amp; Stock Check</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.order_number}</strong>
                    {o.invoice_number && (
                      <div style={{ fontSize: 11, color: 'var(--primary-dark)' }}>{o.invoice_number}</div>
                    )}
                  </td>
                  <td>{o.order_date}</td>
                  <td>
                    {o.customer_name}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.customer_state}</div>
                  </td>
                  <td>{o.salesman_name}</td>
                  <td>
                    {o.items.map((it) => (
                      <div key={it.id} style={{ marginBottom: 4 }}>
                        {it.product_name}: <strong>{Number(it.quantity)}</strong> pkts @ ₹{Number(it.unit_price).toFixed(2)}
                        {o.status !== 'Dispatched' && o.status !== 'Rejected' && (
                          <div style={{ fontSize: 11 }}>
                            Available: {Number(it.available_stock)} pkts{' '}
                            {it.shortage > 0 && (
                              <span className="badge badge-danger">
                                Shortage: {it.shortage} pkts
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </td>
                  <td>₹{Number(o.total_amount).toFixed(2)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>
                    <div className="btn-row">
                      {o.status === 'Submitted' && (
                        <>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(o)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-success btn-sm" onClick={() => handleStatus(o.id, 'Approved')}>
                            Approve
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleStatus(o.id, 'Rejected')}>
                            Reject
                          </button>
                        </>
                      )}
                      {o.status === 'Approved' && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleGenerateInvoice(o.id)}>
                          Generate Invoice
                        </button>
                      )}
                      {o.status === 'Invoiced' && (
                        <button type="button" className="btn btn-success btn-sm" onClick={() => handleDispatch(o.id)}>
                          Dispatch Order
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
