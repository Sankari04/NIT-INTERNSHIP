import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';

export default function ProductionPage() {
  const [boms, setBoms] = useState([]);
  const [runs, setRuns] = useState([]);

  const [productId, setProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchesCount, setBatchesCount] = useState('1');
  const [rawIssued, setRawIssued] = useState({});
  const [actualGoodPackets, setActualGoodPackets] = useState('');
  const [damagedPackaging, setDamagedPackaging] = useState('0');
  const [wastageQty, setWastageQty] = useState('0');
  const [cartonsUsed, setCartonsUsed] = useState('');
  const [labourCost, setLabourCost] = useState('0');
  const [gasElectricityCost, setGasElectricityCost] = useState('0');
  const [otherOverheadCost, setOtherOverheadCost] = useState('0');
  const [notes, setNotes] = useState('');

  const [lastResult, setLastResult] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [bomRes, runsRes] = await Promise.all([api.get('/bom'), api.get('/production')]);
      setBoms(bomRes.data);
      setRuns(runsRes.data);
      if (bomRes.data.length > 0 && !productId) {
        initFormForBom(bomRes.data[0], 1);
      }
    } catch (err) {
      setError('Failed to load production data.');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function initFormForBom(bom, batchMult = 1) {
    setProductId(String(bom.product_id));
    const initialRaw = {};
    let defaultCartons = '';
    bom.items.forEach((it) => {
      if (it.item_type === 'RAW_MATERIAL') {
        initialRaw[it.raw_material_id] = String(Number(it.standard_quantity) * batchMult);
      } else if (String(it.material_name).toLowerCase().includes('carton')) {
        defaultCartons = String(Number(it.standard_quantity) * batchMult);
      }
    });
    setRawIssued(initialRaw);
    setCartonsUsed(defaultCartons);
    setActualGoodPackets(String(Number(bom.expected_output) * batchMult));
  }

  const selectedBom = boms.find((b) => String(b.product_id) === String(productId));
  const multiplier = Number(batchesCount) || 1;
  const expectedOutput = selectedBom ? Number(selectedBom.expected_output) * multiplier : 0;
  const liveYieldVar =
    expectedOutput > 0 && actualGoodPackets !== ''
      ? (((Number(actualGoodPackets) - expectedOutput) / expectedOutput) * 100).toFixed(2)
      : '0.00';

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setLastResult(null);

    try {
      const rawMaterialsPayload = Object.entries(rawIssued).map(([rmId, qty]) => ({
        raw_material_id: Number(rmId),
        actual_quantity: Number(qty),
      }));

      const res = await api.post('/production', {
        product_id: Number(productId),
        batch_number: batchNumber,
        production_date: productionDate,
        batches_count: multiplier,
        actual_good_packets: Number(actualGoodPackets),
        damaged_packaging: Number(damagedPackaging || 0),
        wastage_qty: Number(wastageQty || 0),
        cartons_used: cartonsUsed !== '' ? Number(cartonsUsed) : undefined,
        raw_materials_issued: rawMaterialsPayload,
        labour_cost: Number(labourCost || 0),
        gas_electricity_cost: Number(gasElectricityCost || 0),
        other_overhead_cost: Number(otherOverheadCost || 0),
        notes,
      });

      setLastResult(res.data);
      setMessage(`Production Run ${res.data.batch_number} saved and inventory updated.`);
      setBatchNumber('');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record production run.');
    }
  }

  return (
    <AppLayout title="Production Management & Costing">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {lastResult?.warnings?.length > 0 && (
        <div className="alert alert-warning">
          <strong>Variance Warnings (&gt; ±3%):</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {lastResult.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {lastResult?.costing && (
        <div className="card">
          <h3 className="card-title">Latest Production Costing ({lastResult.batch_number})</h3>
          <div className="kpi-grid" style={{ marginBottom: 0 }}>
            <div className="kpi-card">
              <div className="kpi-label">Raw Material Cost</div>
              <div className="kpi-value">₹{lastResult.costing.rawMaterialCost.toFixed(2)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Packaging Cost</div>
              <div className="kpi-value">₹{lastResult.costing.packagingCost.toFixed(2)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Labour &amp; Overheads</div>
              <div className="kpi-value">₹{lastResult.costing.expenseCost.toFixed(2)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Cost / Cost per Packet</div>
              <div className="kpi-value">₹{lastResult.costing.totalProductionCost.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: 'var(--primary-dark)' }}>
                Cost/pkt: ₹{lastResult.costing.costPerPacket.toFixed(2)} | Sell: ₹{lastResult.costing.sellingPricePerPacket.toFixed(2)} | Profit/pkt: ₹{lastResult.costing.profitPerPacket.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Record Production Run</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Product (with BOM)</label>
              <select
                value={productId}
                onChange={(e) => {
                  const found = boms.find((b) => String(b.product_id) === e.target.value);
                  if (found) initFormForBom(found, multiplier);
                }}
                required
              >
                {boms.map((b) => (
                  <option key={b.id} value={b.product_id}>
                    {b.product_name} ({b.product_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Batch Number (Auto if blank)</label>
              <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. BATCH-MRK-001" />
            </div>
            <div className="form-group">
              <label>Production Date</label>
              <input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Number of Batches</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={batchesCount}
                onChange={(e) => {
                  const val = e.target.value;
                  setBatchesCount(val);
                  if (selectedBom) initFormForBom(selectedBom, Number(val) || 1);
                }}
              />
            </div>
            <div className="form-group">
              <label>Expected Output (BOM)</label>
              <input value={`${expectedOutput} packets`} disabled />
            </div>
            <div className="form-group">
              <label>Actual Good Packets Produced</label>
              <input
                type="number"
                step="1"
                min="0"
                value={actualGoodPackets}
                onChange={(e) => setActualGoodPackets(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Damaged Packaging (pouches)</label>
              <input type="number" step="1" min="0" value={damagedPackaging} onChange={(e) => setDamagedPackaging(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Wastage / Scrap Qty</label>
              <input type="number" step="0.01" min="0" value={wastageQty} onChange={(e) => setWastageQty(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Cartons Used</label>
              <input type="number" step="1" min="0" value={cartonsUsed} onChange={(e) => setCartonsUsed(e.target.value)} />
            </div>
          </div>

          {selectedBom && (
            <div style={{ margin: '14px 0', padding: 12, background: 'var(--bg-accent-soft)', borderRadius: 6 }}>
              <strong style={{ display: 'block', marginBottom: 8 }}>
                Raw Materials Issued (Planned vs Actual) — Live Yield Variance: {liveYieldVar}%
                {Math.abs(Number(liveYieldVar)) > 3 && (
                  <span className="badge badge-danger" style={{ marginLeft: 8 }}>Exceeds ±3%</span>
                )}
              </strong>
              <div className="form-grid">
                {selectedBom.items
                  .filter((it) => it.item_type === 'RAW_MATERIAL')
                  .map((it) => {
                    const planned = Number(it.standard_quantity) * multiplier;
                    const actualVal = rawIssued[it.raw_material_id] ?? '';
                    const pct = planned > 0 && actualVal !== '' ? (((Number(actualVal) - planned) / planned) * 100).toFixed(2) : '0.00';
                    return (
                      <div key={it.id} className="form-group">
                        <label>
                          {it.material_name} (Planned: {planned} {it.unit} | Stock: {Number(it.current_stock)})
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={actualVal}
                          onChange={(e) =>
                            setRawIssued({ ...rawIssued, [it.raw_material_id]: e.target.value })
                          }
                          required
                        />
                        <span style={{ fontSize: 11, color: Math.abs(Number(pct)) > 3 ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                          Variance: {Number(pct) > 0 ? `+${pct}%` : `${pct}%`}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Packaging pouches consumed automatically = Good Packets ({Number(actualGoodPackets || 0)}) + Damaged Pouches ({Number(damagedPackaging || 0)}) = {Number(actualGoodPackets || 0) + Number(damagedPackaging || 0)} pieces.
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Labour Cost (₹)</label>
              <input type="number" step="0.01" min="0" value={labourCost} onChange={(e) => setLabourCost(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Gas &amp; Electricity (₹)</label>
              <input type="number" step="0.01" min="0" value={gasElectricityCost} onChange={(e) => setGasElectricityCost(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Other Overhead (₹)</label>
              <input type="number" step="0.01" min="0" value={otherOverheadCost} onChange={(e) => setOtherOverheadCost(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shift / batch remarks" />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 6 }}>
            Save Production Run &amp; Update Stock
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">Production History, Variance &amp; Costing</h3>
        {runs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No production runs recorded yet.</p>
        ) : (
          runs.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--border-light)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div>
                  <strong>{r.batch_number}</strong> — {r.product_name} ({r.production_date})
                </div>
                <div className="btn-row">
                  <span className={`badge ${Math.abs(Number(r.yield_variance_pct)) > 3 ? 'badge-danger' : 'badge-success'}`}>
                    Yield Variance: {Number(r.yield_variance_pct) > 0 ? `+${r.yield_variance_pct}%` : `${r.yield_variance_pct}%`}
                  </span>
                  <span className="badge badge-info">Cost/pkt: ₹{Number(r.cost_per_packet).toFixed(2)}</span>
                  <span className="badge badge-success">Profit/pkt: ₹{Number(r.profit_per_packet).toFixed(2)}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-muted)' }}>
                Expected: {Number(r.expected_output)} | Actual Good: <strong>{Number(r.actual_good_packets)}</strong> | Damaged Pkg: {Number(r.damaged_packaging)} | Cartons: {Number(r.cartons_used)} | Total Cost: ₹{Number(r.total_production_cost).toFixed(2)}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Planned</th>
                      <th>Actual</th>
                      <th>Difference</th>
                      <th>Variance %</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.materials.map((m) => (
                      <tr key={m.id}>
                        <td>{m.material_name}</td>
                        <td>{Number(m.planned_quantity)} {m.unit}</td>
                        <td>{Number(m.actual_quantity)} {m.unit}</td>
                        <td>{Number(m.variance_quantity) > 0 ? `+${Number(m.variance_quantity)}` : Number(m.variance_quantity)} {m.unit}</td>
                        <td>
                          <span className={`badge ${m.exceeds_threshold ? 'badge-danger' : 'badge-success'}`}>
                            {Number(m.variance_pct) > 0 ? `+${m.variance_pct}%` : `${m.variance_pct}%`}
                          </span>
                        </td>
                        <td>₹{Number(m.total_cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
