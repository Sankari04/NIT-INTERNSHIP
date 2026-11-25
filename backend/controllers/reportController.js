const pool = require('../config/db');
const { round2 } = require('../services/calculationService');

function buildDateFilter(column, fromDate, toDate) {
  const conditions = [];
  const params = [];
  if (fromDate) {
    conditions.push(`${column} >= ?`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`${column} <= ?`);
    params.push(toDate);
  }
  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    andClause: conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function getInventoryOverview(req, res) {
  try {
    const [rawMaterials] = await pool.query('SELECT * FROM raw_materials ORDER BY name ASC');
    const [packagingMaterials] = await pool.query('SELECT * FROM packaging_materials ORDER BY name ASC');
    const [finishedGoods] = await pool.query('SELECT * FROM products ORDER BY name ASC');
    const [ledger] = await pool.query(
      'SELECT * FROM stock_ledger ORDER BY id DESC LIMIT 200'
    );

    return res.json({
      rawMaterials,
      packagingMaterials,
      finishedGoods,
      ledger,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load inventory overview.' });
  }
}

async function getReport(req, res) {
  try {
    const { type } = req.params;
    const { fromDate, toDate } = req.query;

    switch (type) {
      case 'sales-register': {
        const df = buildDateFilter('inv.invoice_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT inv.invoice_number, inv.invoice_date, inv.status, o.order_number,
                  c.name AS customer_name, c.state AS customer_state, c.gstin,
                  inv.tax_type, inv.taxable_amount, inv.cgst_amount, inv.sgst_amount,
                  inv.igst_amount, inv.grand_total, inv.credit_note_number
           FROM invoices inv
           JOIN customers c ON inv.customer_id = c.id
           JOIN orders o ON inv.order_id = o.id
           ${df.clause}
           ORDER BY inv.invoice_date DESC, inv.id DESC`,
          df.params
        );
        return res.json(rows);
      }

      case 'customer-sales': {
        const df = buildDateFilter('inv.invoice_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT c.name AS customer_name, c.customer_type, c.state,
                  COUNT(inv.id) AS invoice_count,
                  COALESCE(SUM(inv.taxable_amount), 0) AS taxable_amount,
                  COALESCE(SUM(inv.cgst_amount + inv.sgst_amount + inv.igst_amount), 0) AS total_gst,
                  COALESCE(SUM(inv.grand_total), 0) AS total_sales
           FROM customers c
           LEFT JOIN invoices inv ON inv.customer_id = c.id AND inv.status = 'ACTIVE' ${df.andClause}
           GROUP BY c.id
           ORDER BY total_sales DESC`,
          df.params
        );
        return res.json(rows);
      }

      case 'product-sales': {
        const df = buildDateFilter('inv.invoice_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT p.product_code, p.name AS product_name, p.hsn_code,
                  COALESCE(SUM(ii.quantity), 0) AS quantity_sold,
                  COALESCE(SUM(ii.taxable_amount), 0) AS taxable_amount,
                  COALESCE(SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount), 0) AS total_gst,
                  COALESCE(SUM(ii.line_total), 0) AS total_sales
           FROM products p
           LEFT JOIN invoice_items ii ON ii.product_id = p.id
           LEFT JOIN invoices inv ON ii.invoice_id = inv.id AND inv.status = 'ACTIVE' ${df.andClause}
           GROUP BY p.id
           ORDER BY total_sales DESC`,
          df.params
        );
        return res.json(rows);
      }

      case 'purchase-register': {
        const df = buildDateFilter('pu.purchase_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT pu.purchase_number, pu.purchase_date, s.name AS supplier_name,
                  pi.item_type, COALESCE(rm.name, pm.name) AS material_name,
                  pi.quantity, pi.unit, pi.rate, pi.total_amount
           FROM purchases pu
           JOIN suppliers s ON pu.supplier_id = s.id
           JOIN purchase_items pi ON pi.purchase_id = pu.id
           LEFT JOIN raw_materials rm ON pi.raw_material_id = rm.id
           LEFT JOIN packaging_materials pm ON pi.packaging_material_id = pm.id
           ${df.clause}
           ORDER BY pu.purchase_date DESC, pu.id DESC`,
          df.params
        );
        return res.json(rows);
      }

      case 'gst-summary': {
        const df = buildDateFilter('inv.invoice_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT inv.tax_type, inv.customer_state,
                  COUNT(*) AS invoice_count,
                  COALESCE(SUM(inv.taxable_amount), 0) AS taxable_amount,
                  COALESCE(SUM(inv.cgst_amount), 0) AS cgst_amount,
                  COALESCE(SUM(inv.sgst_amount), 0) AS sgst_amount,
                  COALESCE(SUM(inv.igst_amount), 0) AS igst_amount,
                  COALESCE(SUM(inv.cgst_amount + inv.sgst_amount + inv.igst_amount), 0) AS total_gst,
                  COALESCE(SUM(inv.grand_total), 0) AS grand_total
           FROM invoices inv
           WHERE inv.status = 'ACTIVE' ${df.andClause}
           GROUP BY inv.tax_type, inv.customer_state
           ORDER BY inv.tax_type`,
          df.params
        );
        return res.json(rows);
      }

      case 'raw-material-stock': {
        const [rows] = await pool.query(
          `SELECT name AS material_name, unit, opening_stock, current_stock,
                  purchase_rate AS weighted_avg_rate,
                  ROUND(current_stock * purchase_rate, 2) AS stock_value,
                  reorder_level,
                  CASE WHEN current_stock <= reorder_level THEN 'Low Stock' ELSE 'Normal' END AS status
           FROM raw_materials
           ORDER BY name ASC`
        );
        return res.json(rows);
      }

      case 'packaging-stock': {
        const [rows] = await pool.query(
          `SELECT name AS material_name, unit, opening_stock, current_stock,
                  purchase_rate,
                  ROUND(current_stock * purchase_rate, 2) AS stock_value,
                  reorder_level,
                  CASE WHEN current_stock <= reorder_level THEN 'Low Stock' ELSE 'Normal' END AS status
           FROM packaging_materials
           ORDER BY name ASC`
        );
        return res.json(rows);
      }

      case 'finished-goods-stock': {
        const [rows] = await pool.query(
          `SELECT product_code, name AS product_name, pack_size, opening_stock, current_stock,
                  selling_price, gst_percentage,
                  ROUND(current_stock * selling_price, 2) AS stock_retail_value
           FROM products
           ORDER BY name ASC`
        );
        return res.json(rows);
      }

      case 'stock-ledger': {
        const df = buildDateFilter('sl.transaction_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT sl.id, sl.transaction_date, sl.item_category, sl.item_name, sl.unit,
                  sl.transaction_type, sl.source_document, sl.qty_received, sl.qty_issued, sl.closing_balance
           FROM stock_ledger sl
           ${df.clause}
           ORDER BY sl.id ASC`,
          df.params
        );
        return res.json(rows);
      }

      case 'production-report': {
        const df = buildDateFilter('pr.production_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT pr.batch_number, pr.production_date, p.name AS product_name,
                  pr.expected_output, pr.actual_good_packets, pr.damaged_packaging,
                  pr.wastage_qty, pr.cartons_used, pr.yield_variance_pct,
                  pr.total_raw_material_cost, pr.total_packaging_cost, pr.total_expense_cost,
                  pr.total_production_cost, pr.cost_per_packet, p.selling_price
           FROM production_runs pr
           JOIN products p ON pr.product_id = p.id
           ${df.clause}
           ORDER BY pr.production_date DESC, pr.id DESC`,
          df.params
        );
        return res.json(
          rows.map((r) => ({
            ...r,
            profit_per_packet: round2(Number(r.selling_price) - Number(r.cost_per_packet)),
          }))
        );
      }

      case 'planned-vs-actual': {
        const df = buildDateFilter('pr.production_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT pr.batch_number, pr.production_date, p.name AS product_name,
                  pm.item_type, pm.material_name, pm.unit,
                  pm.planned_quantity, pm.actual_quantity, pm.variance_quantity,
                  pm.variance_pct, pm.exceeds_threshold, pm.unit_cost, pm.total_cost
           FROM production_materials pm
           JOIN production_runs pr ON pm.production_run_id = pr.id
           JOIN products p ON pr.product_id = p.id
           ${df.clause}
           ORDER BY pr.production_date DESC, pm.id ASC`,
          df.params
        );
        return res.json(rows);
      }

      case 'yield-wastage': {
        const df = buildDateFilter('pr.production_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT pr.batch_number, pr.production_date, p.name AS product_name,
                  pr.expected_output, pr.actual_good_packets,
                  ROUND(pr.expected_output - pr.actual_good_packets, 3) AS output_shortfall,
                  pr.damaged_packaging, pr.wastage_qty, pr.yield_variance_pct,
                  pr.has_variance_alert
           FROM production_runs pr
           JOIN products p ON pr.product_id = p.id
           ${df.clause}
           ORDER BY pr.production_date DESC, pr.id DESC`,
          df.params
        );
        return res.json(rows);
      }

      case 'customer-outstanding': {
        const [rows] = await pool.query(
          `SELECT c.name AS customer_name, c.customer_type, c.state,
                  COALESCE(SUM(CASE WHEN inv.status = 'ACTIVE' THEN inv.grand_total ELSE 0 END), 0) AS total_invoiced,
                  COALESCE((
                    SELECT SUM(p.amount)
                    FROM payments p
                    JOIN invoices inv2 ON p.invoice_id = inv2.id
                    WHERE p.customer_id = c.id AND inv2.status = 'ACTIVE'
                  ), 0) AS total_received
           FROM customers c
           LEFT JOIN invoices inv ON inv.customer_id = c.id
           GROUP BY c.id
           ORDER BY c.name ASC`
        );
        return res.json(
          rows.map((r) => ({
            ...r,
            outstanding_amount: round2(Number(r.total_invoiced) - Number(r.total_received)),
          }))
        );
      }

      case 'collection-report': {
        const df = buildDateFilter('p.payment_date', fromDate, toDate);
        const [rows] = await pool.query(
          `SELECT p.payment_number, p.payment_date, c.name AS customer_name,
                  inv.invoice_number, inv.grand_total AS invoice_total,
                  p.amount AS amount_received, p.payment_mode, p.reference_number
           FROM payments p
           JOIN invoices inv ON p.invoice_id = inv.id
           JOIN customers c ON p.customer_id = c.id
           ${df.clause}
           ORDER BY p.payment_date DESC, p.id DESC`,
          df.params
        );
        return res.json(rows);
      }

      case 'audit-logs': {
        const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200');
        return res.json(rows);
      }

      default:
        return res.status(400).json({ message: `Unknown report type: ${type}` });
    }
  } catch (err) {
    console.error('getReport error:', err);
    return res.status(500).json({ message: 'Failed to generate report.' });
  }
}

module.exports = {
  getInventoryOverview,
  getReport,
};
