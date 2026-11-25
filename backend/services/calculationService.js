/**
 * Pure calculation helpers for inventory valuation, BOM variances, GST, and costing.
 */

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round3(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

/**
 * Weighted-average purchase valuation:
 * (existingQty * existingRate + purchaseQty * purchaseRate) / (existingQty + purchaseQty)
 */
function calculateWeightedAverageRate(existingQty, existingRate, purchaseQty, purchaseRate) {
  const currentQty = Math.max(0, Number(existingQty) || 0);
  const currentRate = Number(existingRate) || 0;
  const addedQty = Number(purchaseQty) || 0;
  const addedRate = Number(purchaseRate) || 0;

  const totalQty = currentQty + addedQty;
  if (totalQty <= 0) {
    return round4(addedRate);
  }
  const totalValue = currentQty * currentRate + addedQty * addedRate;
  return round4(totalValue / totalQty);
}

/**
 * Yield variance percentage: ((actualGood - expectedOutput) / expectedOutput) * 100
 */
function calculateYieldVariance(expectedOutput, actualGoodPackets) {
  const expected = Number(expectedOutput) || 0;
  const actual = Number(actualGoodPackets) || 0;
  if (expected <= 0) return 0;
  return round2(((actual - expected) / expected) * 100);
}

/**
 * Material consumption variance against BOM planned quantity.
 * Flags variance exceeding +/- 3%.
 */
function calculateConsumptionVariance(plannedQty, actualQty, thresholdPct = 3) {
  const planned = Number(plannedQty) || 0;
  const actual = Number(actualQty) || 0;
  const diff = round3(actual - planned);
  const variancePct = planned > 0 ? round2((diff / planned) * 100) : 0;
  const exceedsThreshold = Math.abs(variancePct) > thresholdPct;

  return {
    plannedQuantity: round3(planned),
    actualQuantity: round3(actual),
    difference: diff,
    variancePct,
    exceedsThreshold,
  };
}

/**
 * GST breakdown based on supplier and customer state.
 * Intra-state -> CGST (rate/2) + SGST (rate/2)
 * Inter-state -> IGST (rate)
 */
function calculateGstBreakdown({ supplierState, customerState, taxableAmount, gstPercentage }) {
  const taxable = round2(taxableAmount);
  const rate = Number(gstPercentage) || 0;
  const sameState =
    String(supplierState || '').trim().toLowerCase() ===
    String(customerState || '').trim().toLowerCase();

  if (sameState) {
    const halfRate = rate / 2;
    const cgst = round2((taxable * halfRate) / 100);
    const sgst = round2((taxable * halfRate) / 100);
    return {
      taxType: 'CGST_SGST',
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: 0,
      grandTotal: round2(taxable + cgst + sgst),
    };
  }

  const igst = round2((taxable * rate) / 100);
  return {
    taxType: 'IGST',
    taxableAmount: taxable,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: igst,
    grandTotal: round2(taxable + igst),
  };
}

/**
 * Production costing summary per good packet produced.
 */
function calculateProductionCost({ rawMaterialCost, packagingCost, expenseCost, actualGoodPackets, sellingPrice }) {
  const rm = round2(rawMaterialCost);
  const pkg = round2(packagingCost);
  const exp = round2(expenseCost);
  const totalCost = round2(rm + pkg + exp);
  const goodQty = Number(actualGoodPackets) || 0;
  const costPerPacket = goodQty > 0 ? round4(totalCost / goodQty) : 0;
  const sell = round2(sellingPrice || 0);
  const profitPerPacket = round2(sell - costPerPacket);

  return {
    rawMaterialCost: rm,
    packagingCost: pkg,
    expenseCost: exp,
    totalProductionCost: totalCost,
    costPerPacket,
    sellingPricePerPacket: sell,
    profitPerPacket,
  };
}

/**
 * Returns Indian Financial Year string (April-March), e.g., 'FY26-27'.
 */
function getFinancialYear(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `FY${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

module.exports = {
  round2,
  round3,
  round4,
  calculateWeightedAverageRate,
  calculateYieldVariance,
  calculateConsumptionVariance,
  calculateGstBreakdown,
  calculateProductionCost,
  getFinancialYear,
};
