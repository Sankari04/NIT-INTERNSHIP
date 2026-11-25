import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function SalesmanOrdersPage() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: '1' }]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    try {
      const [custRes, prodRes, ordRes] = await Promise.all([
        api.get('/master/customers'),
        api.get('/master/products'),
        api.get('/orders'),
      ]);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
      setOrders(ordRes.data);
      if (custRes.data.length > 0 && !customerId) {
        setCustomerId(String(custRes.data[0].id));
      }
      if (prodRes.data.length > 0 && items[0]?.product_id === '') {
        setItems([{ product_id: String(prodRes.data[0].id), quantity: '1' }]);
      }
    } catch (err) {
      setError('Failed to load order form data.');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const enrichedItems = items.map((it) => {
    const prod = products.find((p) => String(p.id) === String(it.product_id));
    const price = prod ? Number(prod.selling_price) : 0;
    const qty = Number(it.quantity) || 0;
    return {
      ...it,
      product: prod,
      unit_price: price,
      line_total: price * qty,
    };
  });

  const orderTotal = enrichedItems.reduce((sum, it) => sum + it.line_total, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.post('/orders', {
        customer_id: Number(customerId),
        order_date: orderDate,
        notes,
        items: items.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
        })),
      });
      setMessage(`Order ${res.data.order_number} submitted successfully (Total: ₹${Number(res.data.total_amount).toFixed(2)}).`);
      setNotes('');
      setItems([{ product_id: products[0] ? String(products[0].id) : '', quantity: '1' }]);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit order.');
    }
  }

  return (
    <AppLayout title="Place Order & Order History">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="card-title">New Sales Order</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customer_type} - {c.state})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Order Date</label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
            </div>
          </div>

          {enrichedItems.map((it, idx) => (
            <div key={idx} className="form-grid" style={{ alignItems: 'end', background: 'var(--bg-accent-soft)', padding: 10, borderRadius: 6, marginBottom: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Product</label>
                <select
                  value={it.product_id}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...next[idx], product_id: e.target.value };
                    setItems(next);
                  }}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.selling_price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Quantity (packets)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={it.quantity}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...next[idx], quantity: e.target.value };
                    setItems(next);
                  }}
                  required
                />
              </div>
              <div style={{ fontSize: 13 }}>
                <div>Unit Price: <strong>₹{it.unit_price.toFixed(2)}</strong></div>
                <div>Line Total: <strong>₹{it.line_total.toFixed(2)}</strong></div>
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <div className="btn-row" style={{ marginTop: 8, marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setItems([...items, { product_id: products[0] ? String(products[0].id) : '', quantity: '1' }])}
            >
              + Add Another Product
            </button>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery remarks" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>
              Order Total (Pre-GST): ₹{orderTotal.toFixed(2)}
            </div>
            <button type="submit" className="btn btn-primary">
              Submit Order
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">My Order History &amp; Status Tracking</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.order_number}</strong></td>
                  <td>{o.order_date}</td>
                  <td>{o.customer_name} ({o.customer_state})</td>
                  <td>
                    {o.items.map((it) => `${it.product_name} × ${Number(it.quantity)}`).join(', ')}
                  </td>
                  <td>₹{Number(o.total_amount).toFixed(2)}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
