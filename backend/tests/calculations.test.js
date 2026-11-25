const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateWeightedAverageRate,
  calculateYieldVariance,
  calculateConsumptionVariance,
  calculateGstBreakdown,
  calculateProductionCost,
  getFinancialYear,
} = require('../services/calculationService');

test('Weighted-average valuation calculates exact rate for Flour benchmark', () => {
  // Opening: 100 kg @ Rs.42 + Purchase: 60 kg @ Rs.45 -> (4200 + 2700) / 160 = 43.125
  const rate = calculateWeightedAverageRate(100, 42, 60, 45);
  assert.equal(rate, 43.125);
});

test('Yield variance calculates -6% for 188 vs 200 packets', () => {
  const variance = calculateYieldVariance(200, 188);
  assert.equal(variance, -6);
});

test('Material consumption variance flags > 3% for Oil (10.5L vs 10L = +5%)', () => {
  const result = calculateConsumptionVariance(10, 10.5);
  assert.equal(result.difference, 0.5);
  assert.equal(result.variancePct, 5);
  assert.equal(result.exceedsThreshold, true);

  const okResult = calculateConsumptionVariance(40, 40);
  assert.equal(okResult.variancePct, 0);
  assert.equal(okResult.exceedsThreshold, false);
});

test('GST calculation splits CGST+SGST for intra-state (Tamil Nadu) and IGST for inter-state (Karnataka)', () => {
  const tn = calculateGstBreakdown({
    supplierState: 'Tamil Nadu',
    customerState: 'Tamil Nadu',
    taxableAmount: 7500,
    gstPercentage: 5,
  });
  assert.equal(tn.taxType, 'CGST_SGST');
  assert.equal(tn.cgstAmount, 187.5);
  assert.equal(tn.sgstAmount, 187.5);
  assert.equal(tn.igstAmount, 0);
  assert.equal(tn.grandTotal, 7875);

  const ka = calculateGstBreakdown({
    supplierState: 'Tamil Nadu',
    customerState: 'Karnataka',
    taxableAmount: 6000,
    gstPercentage: 5,
  });
  assert.equal(ka.taxType, 'IGST');
  assert.equal(ka.cgstAmount, 0);
  assert.equal(ka.sgstAmount, 0);
  assert.equal(ka.igstAmount, 300);
  assert.equal(ka.grandTotal, 6300);
});

test('Production costing computes total cost, cost per packet, and profit per packet', () => {
  // Raw: 40*43.125 (1725) + 10.5*140 (1470) + 1.2*200 (240) = 3435
  // Pkg: 194*2.50 (485) + 9*15 (135) = 620
  // Exp: 1200 + 600 = 1800
  // Total: 5855 / 188 = 31.1436 per packet
  const costing = calculateProductionCost({
    rawMaterialCost: 3435,
    packagingCost: 620,
    expenseCost: 1800,
    actualGoodPackets: 188,
    sellingPrice: 50,
  });
  assert.equal(costing.totalProductionCost, 5855);
  assert.equal(costing.costPerPacket, 31.1436);
  assert.equal(costing.profitPerPacket, 18.86);
});

test('Financial year helper resolves Indian FY correctly', () => {
  assert.equal(getFinancialYear('2026-11-25'), 'FY26-27');
  assert.equal(getFinancialYear('2026-02-15'), 'FY25-26');
});
