import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard.'));
  }, []);

  if (error) {
    return (
      <AppLayout title="Dashboard">
        <div className="alert alert-error">{error}</div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="Dashboard">
        <div className="card">Loading dashboard...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      {data.role === 'admin' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Orders Today</div>
              <div className="kpi-value">{data.ordersToday}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pending Orders</div>
              <div className="kpi-value">{data.pendingOrders}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Sales</div>
              <div className="kpi-value">₹{Number(data.totalSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Finished Goods Stock</div>
              <div className="kpi-value">{data.totalFinishedPackets} pkts</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Low-Stock Raw Materials</div>
              <div className="kpi-value">{data.lowStockRawMaterials.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Outstanding Payments</div>
              <div className="kpi-value">₹{Number(data.outstandingPayments).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Available Finished Goods</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Available Stock (packets)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.availableFinishedGoods.map((p) => (
                    <tr key={p.id}>
                      <td>{p.product_code}</td>
                      <td>{p.name}</td>
                      <td><strong>{Number(p.current_stock)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.lowStockRawMaterials.length > 0 && (
            <div className="card">
              <h3 className="card-title">Low-Stock Raw Material Alerts</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Current Stock</th>
                      <th>Reorder Level</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStockRawMaterials.map((rm) => (
                      <tr key={rm.id}>
                        <td>{rm.name}</td>
                        <td><span className="badge badge-danger">{rm.current_stock}</span></td>
                        <td>{rm.reorder_level}</td>
                        <td>{rm.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {data.role === 'production' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total Production Runs</div>
              <div className="kpi-value">{data.totalProductionRuns}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Today's Production</div>
              <div className="kpi-value">{data.todaysProductionPackets} pkts</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Raw Material Items</div>
              <div className="kpi-value">{data.rawMaterialAvailability.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Variance Alerts (&gt;3%)</div>
              <div className="kpi-value">{data.productionVarianceAlerts.length}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Raw Material Availability</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Available Stock</th>
                    <th>Unit</th>
                    <th>Weighted Avg Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rawMaterialAvailability.map((rm) => (
                    <tr key={rm.id}>
                      <td>{rm.name}</td>
                      <td><strong>{Number(rm.current_stock)}</strong></td>
                      <td>{rm.unit}</td>
                      <td>₹{Number(rm.purchase_rate).toFixed(2)}</td>
                      <td>
                        <StatusBadge status={Number(rm.current_stock) <= Number(rm.reorder_level) ? 'Low Stock' : 'Normal'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Production Variance Alerts (&gt; ±3%)</h3>
            {data.productionVarianceAlerts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No variance alerts recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Product</th>
                      <th>Date</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Yield Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.productionVarianceAlerts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.batch_number}</td>
                        <td>{a.product_name}</td>
                        <td>{a.production_date}</td>
                        <td>{a.expected_output}</td>
                        <td>{a.actual_good_packets}</td>
                        <td>
                          <span className="badge badge-danger">{a.yield_variance_pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {data.role === 'salesman' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total Orders</div>
              <div className="kpi-value">{data.totalOrders}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pending Orders</div>
              <div className="kpi-value">{data.pendingOrders}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Approved / Invoiced</div>
              <div className="kpi-value">{data.approvedOrders}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Dispatched Orders</div>
              <div className="kpi-value">{data.dispatchedOrders}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Recent Orders</h3>
            {data.recentOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No orders placed yet. Use "Place Order &amp; My Orders" to submit one.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order No</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.order_number}</td>
                        <td>{o.customer_name}</td>
                        <td>{o.order_date}</td>
                        <td>₹{Number(o.total_amount).toFixed(2)}</td>
                        <td><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {data.role === 'auditor' && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Monthly Sales (Incl. GST)</div>
            <div className="kpi-value">₹{Number(data.monthlySales.totalSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Invoices: {data.monthlySales.invoiceCount} | GST: ₹{Number(data.monthlySales.totalGst).toFixed(2)}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Purchase Summary</div>
            <div className="kpi-value">₹{Number(data.purchaseSummary.totalPurchases).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Total Purchases: {data.purchaseSummary.purchaseCount}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Stock Summary</div>
            <div className="kpi-value">{Number(data.stockSummary.finished_goods_packets)} pkts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Raw: {data.stockSummary.raw_material_items} items | Pkg: {data.stockSummary.packaging_items} items
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Production Summary</div>
            <div className="kpi-value">{data.productionSummary.totalRuns} runs</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Good Output: {data.productionSummary.totalGoodPackets} pkts | Alerts: {data.productionSummary.alertRuns}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
