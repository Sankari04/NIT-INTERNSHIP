import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'customers', label: 'Customers' },
  { key: 'raw-materials', label: 'Raw Materials' },
  { key: 'packaging-materials', label: 'Packaging Materials' },
  { key: 'suppliers', label: 'Suppliers' },
];

const INITIAL_FORMS = {
  products: { name: '', product_code: '', pack_size: '', selling_price: '', gst_percentage: '5', hsn_code: '21069099', opening_stock: '0' },
  customers: { name: '', customer_type: 'Retailer', contact_number: '', address: '', state: 'Tamil Nadu', gstin: '' },
  'raw-materials': { name: '', unit: 'kg', opening_stock: '0', purchase_rate: '0', reorder_level: '10' },
  'packaging-materials': { name: '', unit: 'pieces', opening_stock: '0', purchase_rate: '0', reorder_level: '20' },
  suppliers: { name: '', contact_number: '', address: '' },
};

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('products');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(INITIAL_FORMS.products);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadTab(tabKey) {
    try {
      const res = await api.get(`/master/${tabKey}`);
      setRows(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load records.');
    }
  }

  useEffect(() => {
    setForm(INITIAL_FORMS[activeTab]);
    setEditingId(null);
    setMessage('');
    setError('');
    loadTab(activeTab);
  }, [activeTab]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      if (editingId) {
        await api.put(`/master/${activeTab}/${editingId}`, form);
        setMessage('Record updated successfully.');
      } else {
        await api.post(`/master/${activeTab}`, form);
        setMessage('Record created successfully.');
      }
      setForm(INITIAL_FORMS[activeTab]);
      setEditingId(null);
      loadTab(activeTab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save record.');
    }
  }

  async function handleDelete(id) {
    setMessage('');
    setError('');
    try {
      await api.delete(`/master/${activeTab}/${id}`);
      setMessage('Record deleted.');
      loadTab(activeTab);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete record.');
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({ ...row });
  }

  return (
    <AppLayout title="Master Data Management">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="card-title">{editingId ? 'Edit Record' : 'Add New Record'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {activeTab === 'products' && (
              <>
                <div className="form-group">
                  <label>Product Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Product Code</label>
                  <input value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Pack Size</label>
                  <input value={form.pack_size} onChange={(e) => setForm({ ...form, pack_size: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Selling Price (₹)</label>
                  <input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>GST %</label>
                  <input type="number" step="0.01" value={form.gst_percentage} onChange={(e) => setForm({ ...form, gst_percentage: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>HSN Code</label>
                  <input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} required />
                </div>
                {!editingId && (
                  <div className="form-group">
                    <label>Opening Stock (packets)</label>
                    <input type="number" step="1" value={form.opening_stock} onChange={(e) => setForm({ ...form, opening_stock: e.target.value })} />
                  </div>
                )}
              </>
            )}

            {activeTab === 'customers' && (
              <>
                <div className="form-group">
                  <label>Customer Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Customer Type</label>
                  <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>
                    <option value="Retailer">Retailer</option>
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>GSTIN</label>
                  <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </div>
              </>
            )}

            {(activeTab === 'raw-materials' || activeTab === 'packaging-materials') && (
              <>
                <div className="form-group">
                  <label>Material Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Purchase Rate (₹)</label>
                  <input type="number" step="0.01" value={form.purchase_rate} onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Reorder Level</label>
                  <input type="number" step="0.01" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                </div>
                {!editingId && (
                  <div className="form-group">
                    <label>Opening Stock</label>
                    <input type="number" step="0.001" value={form.opening_stock} onChange={(e) => setForm({ ...form, opening_stock: e.target.value })} />
                  </div>
                )}
              </>
            )}

            {activeTab === 'suppliers' && (
              <>
                <div className="form-group">
                  <label>Supplier Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </div>
              </>
            )}
          </div>

          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Save Changes' : 'Add Record'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(INITIAL_FORMS[activeTab]);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">Existing Records</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {activeTab === 'products' && (
                  <>
                    <th>Code</th><th>Name</th><th>Pack</th><th>Price</th><th>GST%</th><th>HSN</th><th>Current Stock</th><th>Actions</th>
                  </>
                )}
                {activeTab === 'customers' && (
                  <>
                    <th>Name</th><th>Type</th><th>State</th><th>Contact</th><th>GSTIN</th><th>Address</th><th>Actions</th>
                  </>
                )}
                {(activeTab === 'raw-materials' || activeTab === 'packaging-materials') && (
                  <>
                    <th>Name</th><th>Unit</th><th>Opening</th><th>Current Stock</th><th>Rate (₹)</th><th>Actions</th>
                  </>
                )}
                {activeTab === 'suppliers' && (
                  <>
                    <th>Supplier Name</th><th>Contact</th><th>Address</th><th>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {activeTab === 'products' && (
                    <>
                      <td>{r.product_code}</td><td>{r.name}</td><td>{r.pack_size}</td>
                      <td>₹{Number(r.selling_price).toFixed(2)}</td><td>{r.gst_percentage}%</td><td>{r.hsn_code}</td>
                      <td><strong>{Number(r.current_stock)}</strong></td>
                    </>
                  )}
                  {activeTab === 'customers' && (
                    <>
                      <td>{r.name}</td><td>{r.customer_type}</td><td>{r.state}</td>
                      <td>{r.contact_number}</td><td>{r.gstin || '-'}</td><td>{r.address}</td>
                    </>
                  )}
                  {(activeTab === 'raw-materials' || activeTab === 'packaging-materials') && (
                    <>
                      <td>{r.name}</td><td>{r.unit}</td><td>{Number(r.opening_stock)}</td>
                      <td><strong>{Number(r.current_stock)}</strong></td><td>₹{Number(r.purchase_rate).toFixed(2)}</td>
                    </>
                  )}
                  {activeTab === 'suppliers' && (
                    <>
                      <td>{r.name}</td><td>{r.contact_number}</td><td>{r.address}</td>
                    </>
                  )}
                  <td>
                    <div className="btn-row">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>Edit</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
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
