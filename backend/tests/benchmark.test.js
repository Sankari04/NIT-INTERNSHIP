const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');
const pool = require('../config/db');
const { seedDatabase } = require('../seed/seed');

let server;
let baseUrl;
const databaseName = process.env.DB_NAME || 'order_to_audit_db';
const demoPassword = process.env.DEMO_PASSWORD;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, data };
}

test.before(async () => {
  if (!/_test$/i.test(databaseName)) {
    throw new Error('Benchmark tests require a disposable DB_NAME ending in _test.');
  }
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_PASSWORD to a private password of at least 12 characters.');
  }
  await seedDatabase({ silent: true });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Full 15-point Mandatory Benchmark Scenario', async () => {
  // 1. Login all roles & verify RBAC
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@kaverisnacks.com', password: demoPassword },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;

  const salesmanLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'salesman@kaverisnacks.com', password: demoPassword },
  });
  assert.equal(salesmanLogin.status, 200);
  const salesmanToken = salesmanLogin.data.token;

  const prodLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'production@kaverisnacks.com', password: demoPassword },
  });
  assert.equal(prodLogin.status, 200);
  const prodToken = prodLogin.data.token;

  const auditorLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'auditor@kaverisnacks.com', password: demoPassword },
  });
  assert.equal(auditorLogin.status, 200);
  const auditorToken = auditorLogin.data.token;

  // RBAC check: Salesman cannot access reports, Auditor cannot create orders
  const rbacSalesmanReport = await api('/reports/sales-register', { token: salesmanToken });
  assert.equal(rbacSalesmanReport.status, 403);
  const rbacAuditorOrder = await api('/orders', {
    method: 'POST',
    token: auditorToken,
    body: { customer_id: 1, items: [{ product_id: 1, quantity: 10 }] },
  });
  assert.equal(rbacAuditorOrder.status, 403);

  // 2. Purchase 60 kg Flour @ Rs.45/kg (Existing: 100 kg @ Rs.42/kg)
  const purchaseRes = await api('/purchases', {
    method: 'POST',
    token: prodToken,
    body: {
      supplier_id: 1,
      purchase_date: '2026-11-25',
      items: [{ item_type: 'RAW_MATERIAL', material_id: 1, quantity: 60, rate: 45 }],
    },
  });
  assert.equal(purchaseRes.status, 201);
  assert.equal(purchaseRes.data.total_amount, 2700);

  // Check weighted average rate on Flour = 43.125
  const rawAfterPurchase = await api('/master/raw-materials', { token: prodToken });
  const flourAfterPurchase = rawAfterPurchase.data.find((m) => m.name === 'Flour');
  assert.equal(Number(flourAfterPurchase.current_stock), 160);
  assert.equal(Number(flourAfterPurchase.purchase_rate), 43.125);

  // 3. Record Production Run for Murukku 200 g (product_id = 1)
  // Flour: 40 kg, Oil: 10.5 L, Spice mix: 1.2 kg, Good packets: 188, Damaged pouches: 6, Cartons: 9
  // Labour: 1200, Gas & electricity: 600
  const prodRes = await api('/production', {
    method: 'POST',
    token: prodToken,
    body: {
      product_id: 1,
      batch_number: 'BATCH-MRK-001',
      production_date: '2026-11-25',
      batches_count: 1,
      actual_good_packets: 188,
      damaged_packaging: 6,
      wastage_qty: 12,
      cartons_used: 9,
      raw_materials_issued: [
        { raw_material_id: 1, actual_quantity: 40 },
        { raw_material_id: 2, actual_quantity: 10.5 },
        { raw_material_id: 3, actual_quantity: 1.2 },
      ],
      labour_cost: 1200,
      gas_electricity_cost: 600,
    },
  });
  assert.equal(prodRes.status, 201);
  assert.equal(prodRes.data.yield_variance_pct, -6); // Benchmark #8
  assert.equal(prodRes.data.has_variance_alert, true);
  assert.equal(prodRes.data.costing.rawMaterialCost, 3435);
  assert.equal(prodRes.data.costing.packagingCost, 620);
  assert.equal(prodRes.data.costing.totalProductionCost, 5855);
  assert.equal(prodRes.data.costing.costPerPacket, 31.1436);
  assert.ok(prodRes.data.warnings.some((w) => w.includes('Oil') || w.includes('Cooking oil')));

  // Verify stock balances after production (#1, #2, #3, #4, #5, #6)
  const invAfterProd = await api('/reports/inventory', { token: prodToken });
  const flourStock = invAfterProd.data.rawMaterials.find((r) => r.name === 'Flour');
  const oilStock = invAfterProd.data.rawMaterials.find((r) => r.name === 'Cooking oil');
  const spiceStock = invAfterProd.data.rawMaterials.find((r) => r.name === 'Spice mix');
  const pouchStock = invAfterProd.data.packagingMaterials.find((p) => p.name === '200 g pouch');
  const cartonStock = invAfterProd.data.packagingMaterials.find((p) => p.name === 'Carton');
  const murukkuStock = invAfterProd.data.finishedGoods.find((f) => f.name === 'Murukku 200 g');

  assert.equal(Number(flourStock.current_stock), 120);   // Benchmark #1
  assert.equal(Number(oilStock.current_stock), 19.5);    // Benchmark #2
  assert.equal(Number(spiceStock.current_stock), 3.8);   // Benchmark #3
  assert.equal(Number(pouchStock.current_stock), 306);   // Benchmark #4 (500 - 188 - 6)
  assert.equal(Number(cartonStock.current_stock), 21);   // Benchmark #5 (30 - 9)
  assert.equal(Number(murukkuStock.current_stock), 238); // Benchmark #6 (50 + 188)

  // Verify Oil consumption variance = +5% (#9)
  const pvaRes = await api('/reports/planned-vs-actual', { token: auditorToken });
  const oilVarianceRow = pvaRes.data.find((r) => r.material_name === 'Cooking oil');
  assert.equal(Number(oilVarianceRow.variance_pct), 5);  // Benchmark #9

  // 4. Salesman places Order for Retailer A (150 packets @ Rs.50)
  const orderARes = await api('/orders', {
    method: 'POST',
    token: salesmanToken,
    body: {
      customer_id: 1,
      order_date: '2026-11-25',
      items: [{ product_id: 1, quantity: 150 }],
    },
  });
  assert.equal(orderARes.status, 201);
  const orderAId = orderARes.data.id;

  // Admin approves Retailer A order -> generates GST invoice -> dispatches
  const approveA = await api(`/orders/${orderAId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Approved' },
  });
  assert.equal(approveA.status, 200);

  const invoiceARes = await api(`/invoices/from-order/${orderAId}`, {
    method: 'POST',
    token: adminToken,
    body: { invoice_date: '2026-11-25' },
  });
  assert.equal(invoiceARes.status, 201);
  assert.equal(invoiceARes.data.tax_type, 'CGST_SGST');
  assert.equal(invoiceARes.data.taxable_amount, 7500); // Benchmark #10
  assert.equal(invoiceARes.data.cgst_amount, 187.5);   // Benchmark #11
  assert.equal(invoiceARes.data.sgst_amount, 187.5);   // Benchmark #12
  assert.equal(invoiceARes.data.grand_total, 7875);    // Benchmark #13

  const dispatchARes = await api(`/orders/${orderAId}/dispatch`, {
    method: 'POST',
    token: adminToken,
    body: { dispatch_date: '2026-11-25' },
  });
  assert.equal(dispatchARes.status, 200);

  // Verify Finished Goods after Retailer A dispatch = 88 packets (#7)
  const invAfterDispatch = await api('/reports/inventory', { token: adminToken });
  const murukkuAfterDispatch = invAfterDispatch.data.finishedGoods.find((f) => f.name === 'Murukku 200 g');
  assert.equal(Number(murukkuAfterDispatch.current_stock), 88); // Benchmark #7

  // 5. Retailer A pays Rs.4,000 -> Outstanding = Rs.3,875 (#14)
  const paymentRes = await api('/payments', {
    method: 'POST',
    token: adminToken,
    body: {
      invoice_id: invoiceARes.data.id,
      payment_date: '2026-11-25',
      amount: 4000,
      payment_mode: 'UPI',
    },
  });
  assert.equal(paymentRes.status, 201);
  assert.equal(paymentRes.data.outstanding_amount, 3875); // Benchmark #14

  const outstandingRes = await api('/payments/outstanding', { token: auditorToken });
  const retailerAOut = outstandingRes.data.find((c) => c.customer_name === 'Retailer A');
  assert.equal(Number(retailerAOut.outstanding_balance), 3875); // Benchmark #14

  // 6. Salesman places Order for Distributor B (120 packets)
  const orderBRes = await api('/orders', {
    method: 'POST',
    token: salesmanToken,
    body: {
      customer_id: 2,
      order_date: '2026-11-25',
      items: [{ product_id: 1, quantity: 120 }],
    },
  });
  assert.equal(orderBRes.status, 201);
  const orderBId = orderBRes.data.id;

  // Verify order list clearly shows shortage of 32 packets (#15)
  const ordersList = await api('/orders', { token: adminToken });
  const orderB = ordersList.data.find((o) => o.id === orderBId);
  assert.equal(orderB.has_shortage, true);
  assert.equal(orderB.total_shortage, 32); // Benchmark #15

  // Approve Order B, then verify invoice generation & dispatch are blocked due to shortage of 32 packets
  await api(`/orders/${orderBId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Approved' },
  });

  const blockedInvoice = await api(`/invoices/from-order/${orderBId}`, {
    method: 'POST',
    token: adminToken,
    body: { invoice_date: '2026-11-25' },
  });
  assert.equal(blockedInvoice.status, 400);
  assert.equal(blockedInvoice.data.shortages[0].shortage, 32);

  const blockedDispatch = await api(`/orders/${orderBId}/dispatch`, {
    method: 'POST',
    token: adminToken,
    body: { dispatch_date: '2026-11-25' },
  });
  assert.equal(blockedDispatch.status, 400);
  assert.equal(blockedDispatch.data.shortages[0].shortage, 32);

  // 7. Verify all 14 reports + audit logs return 200 OK with expected rows
  const reportKeys = [
    'sales-register',
    'customer-sales',
    'product-sales',
    'purchase-register',
    'gst-summary',
    'raw-material-stock',
    'packaging-stock',
    'finished-goods-stock',
    'stock-ledger',
    'production-report',
    'planned-vs-actual',
    'yield-wastage',
    'customer-outstanding',
    'collection-report',
    'audit-logs',
  ];

  for (const key of reportKeys) {
    const rep = await api(`/reports/${key}`, { token: auditorToken });
    assert.equal(rep.status, 200, `Report ${key} should return 200`);
    assert.ok(Array.isArray(rep.data) && rep.data.length > 0, `Report ${key} should have data`);
  }

});
