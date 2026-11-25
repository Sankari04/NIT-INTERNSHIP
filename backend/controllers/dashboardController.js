const pool = require('../config/db');

async function getDashboardSummary(req, res) {
  try {
    const role = req.user.role;
    const today = new Date().toISOString().slice(0, 10);

    if (role === 'admin') {
      const [[ordersTodayRow]] = await pool.query(
        'SELECT COUNT(*) AS count FROM orders WHERE order_date = ?',
        [today]
      );
      const [[pendingOrdersRow]] = await pool.query(
        "SELECT COUNT(*) AS count FROM orders WHERE status IN ('Submitted', 'Approved')"
      );
      const [[salesRow]] = await pool.query(
        "SELECT COALESCE(SUM(grand_total), 0) AS total_sales FROM invoices WHERE status = 'ACTIVE'"
      );
      const [finishedGoods] = await pool.query(
        'SELECT id, name, product_code, current_stock FROM products ORDER BY name'
      );
      const [lowStockRaw] = await pool.query(
        'SELECT id, name, unit, current_stock, reorder_level FROM raw_materials WHERE current_stock <= reorder_level ORDER BY name'
      );
      const [[outstandingRow]] = await pool.query(
        `SELECT COALESCE((SELECT SUM(grand_total) FROM invoices WHERE status = 'ACTIVE'), 0) -
                COALESCE((SELECT SUM(p.amount) FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.status = 'ACTIVE'), 0) AS outstanding`
      );

      return res.json({
        role,
        ordersToday: ordersTodayRow.count,
        pendingOrders: pendingOrdersRow.count,
        totalSales: Number(salesRow.total_sales || 0),
        availableFinishedGoods: finishedGoods,
        totalFinishedPackets: finishedGoods.reduce((sum, p) => sum + Number(p.current_stock), 0),
        lowStockRawMaterials: lowStockRaw,
        outstandingPayments: Number(outstandingRow.outstanding || 0),
      });
    }

    if (role === 'production') {
      const [[runsRow]] = await pool.query('SELECT COUNT(*) AS count FROM production_runs');
      const [[todayProdRow]] = await pool.query(
        'SELECT COALESCE(SUM(actual_good_packets), 0) AS packets, COUNT(*) AS runs FROM production_runs WHERE production_date = ?',
        [today]
      );
      const [rawMaterials] = await pool.query(
        'SELECT id, name, unit, current_stock, reorder_level, purchase_rate FROM raw_materials ORDER BY name'
      );
      const [packagingMaterials] = await pool.query(
        'SELECT id, name, unit, current_stock, reorder_level FROM packaging_materials ORDER BY name'
      );
      const [varianceAlerts] = await pool.query(
        `SELECT pr.id, pr.batch_number, p.name AS product_name, pr.production_date,
                pr.expected_output, pr.actual_good_packets, pr.yield_variance_pct
         FROM production_runs pr
         JOIN products p ON pr.product_id = p.id
         WHERE pr.has_variance_alert = TRUE
         ORDER BY pr.created_at DESC
         LIMIT 10`
      );

      return res.json({
        role,
        totalProductionRuns: runsRow.count,
        todaysProductionPackets: Number(todayProdRow.packets || 0),
        todaysProductionRuns: todayProdRow.runs,
        rawMaterialAvailability: rawMaterials,
        packagingAvailability: packagingMaterials,
        productionVarianceAlerts: varianceAlerts,
      });
    }

    if (role === 'salesman') {
      const salesmanId = req.user.id;
      const [[counts]] = await pool.query(
        `SELECT
           COUNT(*) AS total_orders,
           SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) AS pending_orders,
           SUM(CASE WHEN status IN ('Approved', 'Invoiced') THEN 1 ELSE 0 END) AS approved_orders,
           SUM(CASE WHEN status = 'Dispatched' THEN 1 ELSE 0 END) AS dispatched_orders
         FROM orders
         WHERE salesman_id = ?`,
        [salesmanId]
      );
      const [recentOrders] = await pool.query(
        `SELECT o.id, o.order_number, o.order_date, o.status, o.total_amount, c.name AS customer_name
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         WHERE o.salesman_id = ?
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [salesmanId]
      );

      return res.json({
        role,
        totalOrders: Number(counts.total_orders || 0),
        pendingOrders: Number(counts.pending_orders || 0),
        approvedOrders: Number(counts.approved_orders || 0),
        dispatchedOrders: Number(counts.dispatched_orders || 0),
        recentOrders,
      });
    }

    // Auditor dashboard
    const currentMonth = today.slice(0, 7);
    const [[monthlySalesRow]] = await pool.query(
      `SELECT COUNT(*) AS invoice_count,
              COALESCE(SUM(taxable_amount), 0) AS taxable_sales,
              COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total_gst,
              COALESCE(SUM(grand_total), 0) AS total_sales
       FROM invoices
       WHERE status = 'ACTIVE' AND DATE_FORMAT(invoice_date, '%Y-%m') = ?`,
      [currentMonth]
    );
    const [[purchaseSummaryRow]] = await pool.query(
      `SELECT COUNT(*) AS purchase_count, COALESCE(SUM(total_amount), 0) AS total_purchases
       FROM purchases`
    );
    const [[stockSummaryRow]] = await pool.query(
      `SELECT
        (SELECT COALESCE(SUM(current_stock), 0) FROM products) AS finished_goods_packets,
        (SELECT COUNT(*) FROM raw_materials) AS raw_material_items,
        (SELECT COUNT(*) FROM packaging_materials) AS packaging_items`
    );
    const [[prodSummaryRow]] = await pool.query(
      `SELECT COUNT(*) AS total_runs,
              COALESCE(SUM(actual_good_packets), 0) AS total_good_packets,
              SUM(CASE WHEN has_variance_alert = TRUE THEN 1 ELSE 0 END) AS alert_runs
       FROM production_runs`
    );

    return res.json({
      role,
      monthlySales: {
        invoiceCount: monthlySalesRow.invoice_count,
        taxableSales: Number(monthlySalesRow.taxable_sales || 0),
        totalGst: Number(monthlySalesRow.total_gst || 0),
        totalSales: Number(monthlySalesRow.total_sales || 0),
      },
      purchaseSummary: {
        purchaseCount: purchaseSummaryRow.purchase_count,
        totalPurchases: Number(purchaseSummaryRow.total_purchases || 0),
      },
      stockSummary: stockSummaryRow,
      productionSummary: {
        totalRuns: Number(prodSummaryRow.total_runs || 0),
        totalGoodPackets: Number(prodSummaryRow.total_good_packets || 0),
        alertRuns: Number(prodSummaryRow.alert_runs || 0),
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ message: 'Failed to load dashboard data.' });
  }
}

module.exports = {
  getDashboardSummary,
};
