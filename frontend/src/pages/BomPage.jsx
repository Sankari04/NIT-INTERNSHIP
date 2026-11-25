import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BomPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [packagingMaterials, setPackagingMaterials] = useState([]);

  const [productId, setProductId] = useState('');
  const [batchName, setBatchName] = useState('Standard Batch');
  const [expectedOutput, setExpectedOutput] = useState('200');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [bomRes, prodRes, rmRes, pmRes] = await Promise.all([
        api.get('/bom'),
        api.get('/master/products'),
        api.get('/master/raw-materials'),
        api.get('/master/packaging-materials'),
      ]);
      setBoms(bomRes.data);
      setProducts(prodRes.data);
      setRawMaterials(rmRes.data);
      setPackagingMaterials(pmRes.data);
    } catch (err) {
      setError('Failed to load BOM data.');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function loadBomIntoForm(bom) {
    setProductId(String(bom.product_id));
    setBatchName(bom.batch_name);
    setExpectedOutput(String(bom.expected_output));
    setItems(
      bom.items.map((it) => ({
        item_type: it.item_type,
        material_id: String(it.raw_material_id || it.packaging_material_id),
        standard_quantity: String(it.standard_quantity),
        unit: it.unit,
      }))
    );
  }

  function addItemRow(type) {
    const list = type === 'RAW_MATERIAL' ? rawMaterials : packagingMaterials;
    const first = list[0];
    setItems([
      ...items,
      {
        item_type: type,
        material_id: first ? String(first.id) : '',
        standard_quantity: '',
        unit: first ? first.unit : '',
      },
    ]);
  }

  async function handleSave(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.post('/bom', {
        product_id: Number(productId),
        batch_name: batchName,
        expected_output: Number(expectedOutput),
        items: items.map((it) => ({
          item_type: it.item_type,
          material_id: Number(it.material_id),
          standard_quantity: Number(it.standard_quantity),
          unit: it.unit,
        })),
      });
      setMessage('Bill of Materials saved successfully.');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save BOM.');
    }
  }

  return (
    <AppLayout title="Bill of Materials (BOM)">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {isAdmin && (
        <div className="card">
          <h3 className="card-title">Create / Update Product BOM</h3>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label>Finished Product</label>
                <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Batch Name</label>
                <input value={batchName} onChange={(e) => setBatchName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Expected Output (packets/batch)</label>
                <input
                  type="number"
                  step="1"
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="btn-row" style={{ margin: '10px 0' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addItemRow('RAW_MATERIAL')}>
                + Add Raw Material
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addItemRow('PACKAGING')}>
                + Add Packaging Material
              </button>
            </div>

            {items.map((it, idx) => {
              const options = it.item_type === 'RAW_MATERIAL' ? rawMaterials : packagingMaterials;
              return (
                <div key={idx} className="form-grid" style={{ alignItems: 'end', marginBottom: 8 }}>
                  <div className="form-group">
                    <label>{it.item_type === 'RAW_MATERIAL' ? 'Raw Material' : 'Packaging Material'}</label>
                    <select
                      value={it.material_id}
                      onChange={(e) => {
                        const chosen = options.find((o) => String(o.id) === e.target.value);
                        const next = [...items];
                        next[idx] = { ...next[idx], material_id: e.target.value, unit: chosen?.unit || '' };
                        setItems(next);
                      }}
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Standard Quantity ({it.unit})</label>
                    <input
                      type="number"
                      step="0.001"
                      value={it.standard_quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], standard_quantity: e.target.value };
                        setItems(next);
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
              Save BOM
            </button>
          </form>
        </div>
      )}

      {boms.map((b) => (
        <div key={b.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 className="card-title" style={{ marginBottom: 2 }}>
                {b.product_name} ({b.product_code}) — {b.batch_name}
              </h3>
              <span style={{ fontSize: 13, color: 'var(--primary-dark)', fontWeight: 600 }}>
                Expected Output: {Number(b.expected_output)} packets per batch
              </span>
            </div>
            {isAdmin && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadBomIntoForm(b)}>
                Edit BOM
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Material</th>
                  <th>Standard Qty</th>
                  <th>Unit</th>
                  <th>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {b.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.item_type === 'RAW_MATERIAL' ? 'Raw Material' : 'Packaging'}</td>
                    <td>{it.material_name}</td>
                    <td><strong>{Number(it.standard_quantity)}</strong></td>
                    <td>{it.unit}</td>
                    <td>{Number(it.current_stock)} {it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </AppLayout>
  );
}
