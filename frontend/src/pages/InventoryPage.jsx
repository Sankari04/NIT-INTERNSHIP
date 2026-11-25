import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function InventoryPage() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('raw');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/reports/inventory')
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load inventory.'));
  }, []);

  if (error) return <AppLayout title="Inventory & Stock Ledger"><div className="alert alert-error">{error}</div></AppLayout>;
  if (!data) return <AppLayout title="Inventory & Stock Ledger"><div className="card">Loading inventory...</div></AppLayout>;

  return (
    <AppLayout title="Inventory & Stock Ledger">
      <div className="tabs">
        <button type="button" className={`tab-btn ${tab === 'raw' ? 'active' : ''}`} onClick={() => setTab('raw')}>
          Raw Materials ({data.rawMaterials.length})
        </button>
        <button type="button" className={`tab-btn ${tab === 'pkg' ? 'active' : ''}`} onClick={() => setTab('pkg')}>
          Packaging Materials ({data.packagingMaterials.length})
        </button>
        <button type="button" className={`tab-btn ${tab === 'fg' ? 'active' : ''}`} onClick={() => setTab('fg')}>
          Finished Goods ({data.finishedGoods.length})
        </button>
        <button type="button" className={`tab-btn ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>
          Stock Ledger ({data.ledger.length})
        </button>
      </div>

      {tab === 'raw' && (
        <div className="card">
          <h3 className="card-title">Raw Material Stock</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Unit</th><th>Opening</th><th>Current Stock</th><th>Weighted Avg Rate</th><th>Valuation</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.rawMaterials.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.unit}</td>
                    <td>{Number(r.opening_stock)}</td>
                    <td><strong>{Number(r.current_stock)}</strong></td>
                    <td>₹{Number(r.purchase_rate).toFixed(4)}</td>
                    <td>₹{(Number(r.current_stock) * Number(r.purchase_rate)).toFixed(2)}</td>
                    <td><StatusBadge status={Number(r.current_stock) <= Number(r.reorder_level) ? 'Low Stock' : 'Normal'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pkg' && (
        <div className="card">
          <h3 className="card-title">Packaging Material Stock</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Unit</th><th>Opening</th><th>Current Stock</th><th>Rate</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.packagingMaterials.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.unit}</td>
                    <td>{Number(p.opening_stock)}</td>
                    <td><strong>{Number(p.current_stock)}</strong></td>
                    <td>₹{Number(p.purchase_rate).toFixed(2)}</td>
                    <td><StatusBadge status={Number(p.current_stock) <= Number(p.reorder_level) ? 'Low Stock' : 'Normal'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'fg' && (
        <div className="card">
          <h3 className="card-title">Finished Goods Stock</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Product</th><th>Pack Size</th><th>Opening Stock</th><th>Current Stock (packets)</th><th>Selling Price</th></tr>
              </thead>
              <tbody>
                {data.finishedGoods.map((f) => (
                  <tr key={f.id}>
                    <td>{f.product_code}</td>
                    <td><strong>{f.name}</strong></td>
                    <td>{f.pack_size}</td>
                    <td>{Number(f.opening_stock)}</td>
                    <td><strong>{Number(f.current_stock)}</strong></td>
                    <td>₹{Number(f.selling_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="card">
          <h3 className="card-title">Stock Ledger (Audit Trail of All Movements)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Source Document</th>
                  <th>Received</th>
                  <th>Issued</th>
                  <th>Closing Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.map((l) => (
                  <tr key={l.id}>
                    <td>{l.transaction_date}</td>
                    <td>{l.item_category}</td>
                    <td><strong>{l.item_name}</strong></td>
                    <td><span className="badge badge-info">{l.transaction_type}</span></td>
                    <td>{l.source_document}</td>
                    <td>{Number(l.qty_received) > 0 ? `+${Number(l.qty_received)} ${l.unit}` : '-'}</td>
                    <td>{Number(l.qty_issued) > 0 ? `-${Number(l.qty_issued)} ${l.unit}` : '-'}</td>
                    <td><strong>{Number(l.closing_balance)} {l.unit}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
