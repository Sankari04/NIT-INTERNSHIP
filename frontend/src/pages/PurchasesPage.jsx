import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [packagingMaterials, setPackagingMaterials] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemType, setItemType] = useState('RAW_MATERIAL');
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [supRes, rmRes, pmRes, puRes] = await Promise.all([
        api.get('/master/suppliers'),
        api.get('/master/raw-materials'),
        api.get('/master/packaging-materials'),
        api.get('/purchases'),
      ]);
      setSuppliers(supRes.data);
      setRawMaterials(rmRes.data);
      setPackagingMaterials(pmRes.data);
      setPurchases(puRes.data);
      if (supRes.data.length > 0 && !supplierId) setSupplierId(String(supRes.data[0].id));
      if (rmRes.data.length > 0 && !materialId) setMaterialId(String(rmRes.data[0].id));
    } catch (err) {
      setError('Failed to load purchase data.');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const materialOptions = itemType === 'RAW_MATERIAL' ? rawMaterials : packagingMaterials;
  const selectedMat = materialOptions.find((m) => String(m.id) === String(materialId));
  const totalAmount = (Number(quantity) || 0) * (Number(rate) || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.post('/purchases', {
        supplier_id: Number(supplierId),
        purchase_date: purchaseDate,
        notes,
        items: [
          {
            item_type: itemType,
            material_id: Number(materialId),
            quantity: Number(quantity),
            rate: Number(rate),
          },
        ],
      });
      setMessage(`Purchase ${res.data.purchase_number} recorded (Total: ₹${Number(res.data.total_amount).toFixed(2)}). Stock & weighted-avg rate updated.`);
      setQuantity('');
      setRate('');
      setNotes('');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record purchase.');
    }
  }

  return (
    <AppLayout title="Purchase Management">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="card-title">Record Raw Material / Packaging Purchase</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Purchase Date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={itemType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setItemType(nextType);
                  const list = nextType === 'RAW_MATERIAL' ? rawMaterials : packagingMaterials;
                  setMaterialId(list[0] ? String(list[0].id) : '');
                }}
              >
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="PACKAGING">Packaging Material</option>
              </select>
            </div>
            <div className="form-group">
              <label>Material</label>
              <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} required>
                {materialOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit}) — Stock: {Number(m.current_stock)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity ({selectedMat?.unit || 'unit'})</label>
              <input type="number" step="0.001" min="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Rate per {selectedMat?.unit || 'unit'} (₹)</label>
              <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bill / Challan reference" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Total Amount: ₹{totalAmount.toFixed(2)}</strong>
            <button type="submit" className="btn btn-primary">Save Purchase</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">Purchase History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Purchase No</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Material &amp; Qty</th>
                <th>Rate</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.purchase_number}</strong></td>
                  <td>{p.purchase_date}</td>
                  <td>{p.supplier_name}</td>
                  <td>
                    {p.items.map((it) => `${it.material_name}: ${Number(it.quantity)} ${it.unit}`).join(', ')}
                  </td>
                  <td>
                    {p.items.map((it) => `₹${Number(it.rate).toFixed(2)}`).join(', ')}
                  </td>
                  <td><strong>₹{Number(p.total_amount).toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
