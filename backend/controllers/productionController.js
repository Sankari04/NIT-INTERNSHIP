const pool = require('../config/db');
const {
  round2,
  round3,
  calculateYieldVariance,
  calculateConsumptionVariance,
  calculateProductionCost,
} = require('../services/calculationService');
const { recordStockMovement } = require('../services/ledgerService');
const { logAudit } = require('../services/auditService');

async function listProductionRuns(req, res) {
  try {
    const [runs] = await pool.query(
      `SELECT pr.*, p.name AS product_name, p.product_code, p.selling_price, u.name AS created_by_name
       FROM production_runs pr
       JOIN products p ON pr.product_id = p.id
       LEFT JOIN users u ON pr.created_by = u.id
       ORDER BY pr.id DESC`
    );

    const [materials] = await pool.query(
      'SELECT * FROM production_materials ORDER BY item_type ASC, id ASC'
    );
    const [expenses] = await pool.query('SELECT * FROM production_expenses ORDER BY id ASC');

    const matByRun = {};
    for (const m of materials) {
      if (!matByRun[m.production_run_id]) matByRun[m.production_run_id] = [];
      matByRun[m.production_run_id].push(m);
    }

    const expByRun = {};
    for (const e of expenses) {
      if (!expByRun[e.production_run_id]) expByRun[e.production_run_id] = [];
      expByRun[e.production_run_id].push(e);
    }

    const enriched = runs.map((r) => {
      const sellingPrice = Number(r.selling_price || 0);
      const costPerPacket = Number(r.cost_per_packet || 0);
      return {
        ...r,
        profit_per_packet: round2(sellingPrice - costPerPacket),
        materials: matByRun[r.id] || [],
        expenses: expByRun[r.id] || [],
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error('listProductionRuns error:', err);
    return res.status(500).json({ message: 'Failed to load production runs.' });
  }
}

async function createProductionRun(req, res) {
  const conn = await pool.getConnection();
  try {
    const {
      product_id,
      batch_number,
      production_date,
      batches_count = 1,
      actual_good_packets,
      damaged_packaging = 0,
      wastage_qty = 0,
      cartons_used,
      raw_materials_issued = [],
      packaging_issued = [],
      labour_cost = 0,
      gas_electricity_cost = 0,
      other_overhead_cost = 0,
      notes = '',
    } = req.body;

    if (!product_id || actual_good_packets === undefined || Number(actual_good_packets) < 0) {
      return res.status(400).json({ message: 'Product and actual good packets produced are required.' });
    }

    await conn.beginTransaction();

    const [[product]] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
    if (!product) {
      await conn.rollback();
      return res.status(404).json({ message: 'Product not found.' });
    }

    const [[bom]] = await conn.query('SELECT * FROM bom WHERE product_id = ? LIMIT 1', [product_id]);
    if (!bom) {
      await conn.rollback();
      return res.status(400).json({ message: `No BOM defined for ${product.name}. Please define a BOM first.` });
    }

    const [bomItems] = await conn.query(
      `SELECT bi.*, COALESCE(rm.name, pm.name) AS material_name
       FROM bom_items bi
       LEFT JOIN raw_materials rm ON bi.raw_material_id = rm.id
       LEFT JOIN packaging_materials pm ON bi.packaging_material_id = pm.id
       WHERE bi.bom_id = ?
       ORDER BY bi.item_type ASC, bi.id ASC`,
      [bom.id]
    );

    const [[runCount]] = await conn.query('SELECT COUNT(*) AS count FROM production_runs');
    const effectiveBatch =
      (batch_number && batch_number.trim()) ||
      `BATCH-${String(Number(runCount.count) + 1).padStart(4, '0')}`;
    const effectiveDate = production_date || new Date().toISOString().slice(0, 10);
    const batchMultiplier = Number(batches_count) || 1;
    const expectedOutput = round3(Number(bom.expected_output) * batchMultiplier);
    const goodPackets = round3(actual_good_packets);
    const damagedPkg = round3(damaged_packaging);
    const wastage = round3(wastage_qty);
    const cartonsUsedVal = cartons_used !== undefined && cartons_used !== '' ? round3(cartons_used) : null;

    const yieldVariancePct = calculateYieldVariance(expectedOutput, goodPackets);
    const yieldAlert = Math.abs(yieldVariancePct) > 3;

    const rawIssuedMap = {};
    for (const ri of raw_materials_issued) {
      rawIssuedMap[Number(ri.raw_material_id || ri.material_id)] = Number(ri.actual_quantity);
    }

    const pkgIssuedMap = {};
    for (const pi of packaging_issued) {
      pkgIssuedMap[Number(pi.packaging_material_id || pi.material_id)] = Number(pi.actual_quantity);
    }

    const [runRes] = await conn.query(
      `INSERT INTO production_runs (
        batch_number, product_id, bom_id, production_date, batches_count,
        expected_output, actual_good_packets, damaged_packaging, wastage_qty, cartons_used,
        yield_variance_pct, has_variance_alert, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        effectiveBatch,
        product_id,
        bom.id,
        effectiveDate,
        batchMultiplier,
        expectedOutput,
        goodPackets,
        damagedPkg,
        wastage,
        cartonsUsedVal !== null ? cartonsUsedVal : 0,
        yieldVariancePct,
        yieldAlert,
        notes.trim(),
        req.user.id,
      ]
    );
    const productionRunId = runRes.insertId;

    let totalRawCost = 0;
    let totalPkgCost = 0;
    let anyMaterialAlert = false;
    const warnings = [];
    let resolvedCartonsUsed = cartonsUsedVal !== null ? cartonsUsedVal : 0;

    if (yieldAlert) {
      warnings.push(
        `Yield variance is ${yieldVariancePct > 0 ? '+' : ''}${yieldVariancePct}% (Expected: ${expectedOutput}, Actual: ${goodPackets}), exceeding ±3%.`
      );
    }

    for (const bi of bomItems) {
      const plannedQty = round3(Number(bi.standard_quantity) * batchMultiplier);
      let actualQty;
      let unitCost = 0;

      if (bi.item_type === 'RAW_MATERIAL') {
        const rmId = bi.raw_material_id;
        actualQty = rawIssuedMap[rmId] !== undefined ? round3(rawIssuedMap[rmId]) : plannedQty;

        const [[rm]] = await conn.query(
          'SELECT id, name, purchase_rate FROM raw_materials WHERE id = ? FOR UPDATE',
          [rmId]
        );
        unitCost = Number(rm.purchase_rate || 0);

        await recordStockMovement(conn, {
          itemCategory: 'RAW_MATERIAL',
          itemId: rmId,
          transactionDate: effectiveDate,
          transactionType: 'PRODUCTION_ISSUE',
          sourceDocument: effectiveBatch,
          sourceId: productionRunId,
          qtyReceived: 0,
          qtyIssued: actualQty,
          userId: req.user.id,
        });
      } else {
        const pmId = bi.packaging_material_id;
        const lowerName = String(bi.material_name || '').toLowerCase();

        if (pkgIssuedMap[pmId] !== undefined) {
          actualQty = round3(pkgIssuedMap[pmId]);
        } else if (lowerName.includes('carton')) {
          actualQty = cartonsUsedVal !== null ? cartonsUsedVal : plannedQty;
          resolvedCartonsUsed = actualQty;
        } else {
          // Pouches / primary packets account for both good packets and damaged pouches
          actualQty = round3(goodPackets + damagedPkg);
        }

        if (lowerName.includes('carton')) {
          resolvedCartonsUsed = actualQty;
        }

        const [[pm]] = await conn.query(
          'SELECT id, name, purchase_rate FROM packaging_materials WHERE id = ? FOR UPDATE',
          [pmId]
        );
        unitCost = Number(pm.purchase_rate || 0);

        await recordStockMovement(conn, {
          itemCategory: 'PACKAGING',
          itemId: pmId,
          transactionDate: effectiveDate,
          transactionType: 'PRODUCTION_ISSUE',
          sourceDocument: effectiveBatch,
          sourceId: productionRunId,
          qtyReceived: 0,
          qtyIssued: actualQty,
          userId: req.user.id,
        });
      }

      const lineCost = round2(actualQty * unitCost);
      if (bi.item_type === 'RAW_MATERIAL') {
        totalRawCost = round2(totalRawCost + lineCost);
      } else {
        totalPkgCost = round2(totalPkgCost + lineCost);
      }

      const variance = calculateConsumptionVariance(plannedQty, actualQty);
      if (variance.exceedsThreshold) {
        anyMaterialAlert = true;
        warnings.push(
          `${bi.material_name} consumption variance is ${variance.variancePct > 0 ? '+' : ''}${variance.variancePct}% (Planned: ${variance.plannedQuantity} ${bi.unit}, Actual: ${variance.actualQuantity} ${bi.unit}), exceeding ±3%.`
        );
      }

      await conn.query(
        `INSERT INTO production_materials (
          production_run_id, item_type, raw_material_id, packaging_material_id,
          material_name, unit, planned_quantity, actual_quantity, variance_quantity,
          variance_pct, exceeds_threshold, unit_cost, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productionRunId,
          bi.item_type,
          bi.raw_material_id,
          bi.packaging_material_id,
          bi.material_name,
          bi.unit,
          variance.plannedQuantity,
          variance.actualQuantity,
          variance.difference,
          variance.variancePct,
          variance.exceedsThreshold,
          unitCost,
          lineCost,
        ]
      );
    }

    // Add actual good packets produced to finished-goods stock
    await recordStockMovement(conn, {
      itemCategory: 'FINISHED_GOOD',
      itemId: product_id,
      transactionDate: effectiveDate,
      transactionType: 'PRODUCTION_OUTPUT',
      sourceDocument: effectiveBatch,
      sourceId: productionRunId,
      qtyReceived: goodPackets,
      qtyIssued: 0,
      userId: req.user.id,
    });

    // Record production expenses (Labour, Gas & Electricity, Other)
    const expenseEntries = [
      { type: 'Labour', desc: 'Direct production labour', amount: round2(labour_cost) },
      { type: 'Gas & Electricity', desc: 'Cooking fuel and electricity', amount: round2(gas_electricity_cost) },
      { type: 'Other Overhead', desc: 'Miscellaneous production overhead', amount: round2(other_overhead_cost) },
    ].filter((e) => e.amount > 0);

    let totalExpenseCost = 0;
    for (const exp of expenseEntries) {
      totalExpenseCost = round2(totalExpenseCost + exp.amount);
      await conn.query(
        'INSERT INTO production_expenses (production_run_id, expense_type, description, amount) VALUES (?, ?, ?, ?)',
        [productionRunId, exp.type, exp.desc, exp.amount]
      );
    }

    const costing = calculateProductionCost({
      rawMaterialCost: totalRawCost,
      packagingCost: totalPkgCost,
      expenseCost: totalExpenseCost,
      actualGoodPackets: goodPackets,
      sellingPrice: product.selling_price,
    });

    const hasVarianceAlert = yieldAlert || anyMaterialAlert;

    await conn.query(
      `UPDATE production_runs
       SET cartons_used = ?, has_variance_alert = ?,
           total_raw_material_cost = ?, total_packaging_cost = ?,
           total_expense_cost = ?, total_production_cost = ?, cost_per_packet = ?
       WHERE id = ?`,
      [
        resolvedCartonsUsed,
        hasVarianceAlert,
        costing.rawMaterialCost,
        costing.packagingCost,
        costing.expenseCost,
        costing.totalProductionCost,
        costing.costPerPacket,
        productionRunId,
      ]
    );

    await logAudit(conn, {
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_PRODUCTION_RUN',
      entityType: 'PRODUCTION_RUN',
      entityId: productionRunId,
      details: `Batch ${effectiveBatch} (${product.name}): ${goodPackets} good packets, yield variance ${yieldVariancePct}%, cost/packet Rs.${costing.costPerPacket}`,
    });

    await conn.commit();

    return res.status(201).json({
      id: productionRunId,
      batch_number: effectiveBatch,
      expected_output: expectedOutput,
      actual_good_packets: goodPackets,
      yield_variance_pct: yieldVariancePct,
      has_variance_alert: hasVarianceAlert,
      warnings,
      costing,
      message: 'Production run saved and inventory updated automatically.',
    });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ message: err.message || 'Failed to record production run.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listProductionRuns,
  createProductionRun,
};
