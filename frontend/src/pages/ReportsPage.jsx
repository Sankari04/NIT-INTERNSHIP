import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import { exportReportToPdf, exportToCsv, exportToExcel } from '../services/exportUtils';

const REPORTS = [
  { key: 'sales-register', label: '1. Sales Register' },
  { key: 'customer-sales', label: '2. Customer-wise Sales' },
  { key: 'product-sales', label: '3. Product-wise Sales' },
  { key: 'purchase-register', label: '4. Purchase Register' },
  { key: 'gst-summary', label: '5. GST Summary' },
  { key: 'raw-material-stock', label: '6. Raw Material Stock Report' },
  { key: 'packaging-stock', label: '7. Packaging Stock Report' },
  { key: 'finished-goods-stock', label: '8. Finished Goods Stock Report' },
  { key: 'stock-ledger', label: '9. Stock Ledger' },
  { key: 'production-report', label: '10. Production Report' },
  { key: 'planned-vs-actual', label: '11. Planned vs Actual Consumption' },
  { key: 'yield-wastage', label: '12. Yield and Wastage Report' },
  { key: 'customer-outstanding', label: '13. Customer Outstanding Report' },
  { key: 'collection-report', label: '14. Collection Report' },
  { key: 'audit-logs', label: 'Audit Trail Logs' },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState('sales-register');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchReport(reportKey = selectedReport) {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get(`/reports/${reportKey}`, { params });
      setRows(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport(selectedReport);
  }, [selectedReport]);

  const currentMeta = REPORTS.find((r) => r.key === selectedReport);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <AppLayout title="Reports & Exports">
      <div className="card">
        <h3 className="card-title">Select Report &amp; Date Filters</h3>
        <div className="form-grid" style={{ alignItems: 'end' }}>
          <div className="form-group">
            <label>Report</label>
            <select value={selectedReport} onChange={(e) => setSelectedReport(e.target.value)}>
              {REPORTS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button type="button" className="btn btn-primary" onClick={() => fetchReport(selectedReport)}>
              Apply Filter
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFromDate('');
                setToDate('');
                fetchReport(selectedReport);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={rows.length === 0}
            onClick={() => exportToCsv(selectedReport, rows)}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={rows.length === 0}
            onClick={() => exportToExcel(selectedReport, rows, currentMeta?.label.slice(0, 28) || 'Report')}
          >
            Export Excel (.xlsx)
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={rows.length === 0}
            onClick={() => exportReportToPdf(currentMeta?.label || selectedReport, rows, selectedReport)}
          >
            Export PDF
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="card-title">{currentMeta?.label} ({rows.length} rows)</h3>
        {loading ? (
          <p>Loading report...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No records found for this report and date range.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columns.map((col) => (
                      <td key={col}>{row[col] === null || row[col] === undefined ? '-' : String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
