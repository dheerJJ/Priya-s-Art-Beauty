'use strict';
/**
 * Monetary calculation utilities using integer arithmetic to avoid floating-point errors.
 * All amounts are stored as paise (1 rupee = 100 paise) internally during calculation,
 * then converted to decimal for storage/display.
 */

/**
 * Round a number to 2 decimal places, returning a Number (not string).
 */
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Calculate bill totals from items, discount, and tax rate.
 *
 * @param {Array} items - [{ qty, unit_price }]
 * @param {number} discountValue - Discount value (fixed amount or percentage)
 * @param {string} discountType - 'fixed' | 'percent'
 * @param {number} taxRate - Tax percentage (e.g. 18 for 18%)
 * @returns {{ subtotal, discount_amount, tax_amount, total }}
 */
function calculateBillTotals(items, discountValue = 0, discountType = 'fixed', taxRate = 0) {
  // Validate inputs
  const safeItems = Array.isArray(items) ? items : [];

  // Calculate line totals and subtotal using integer paise to avoid float errors
  let subtotalPaise = 0;
  const processedItems = safeItems.map((item) => {
    const qty = Math.max(1, Math.round(Number(item.qty) || 1));
    const unitPrice = Math.max(0, round2(item.unit_price || item.price || 0));
    const lineTotal = round2(qty * unitPrice);
    subtotalPaise += Math.round(lineTotal * 100);
    return { ...item, qty, unit_price: unitPrice, line_total: lineTotal };
  });

  const subtotal = subtotalPaise / 100;

  // Calculate discount
  let discountAmount = 0;
  const discountVal = Math.max(0, Number(discountValue) || 0);
  if (discountType === 'percent') {
    discountAmount = round2((subtotal * Math.min(discountVal, 100)) / 100);
  } else {
    discountAmount = round2(Math.min(discountVal, subtotal));
  }

  // After-discount amount
  const afterDiscount = round2(subtotal - discountAmount);

  // Calculate tax
  const taxRateVal = Math.max(0, Number(taxRate) || 0);
  const taxAmount = round2((afterDiscount * taxRateVal) / 100);

  // Final total
  const total = round2(afterDiscount + taxAmount);

  return {
    items: processedItems,
    subtotal: round2(subtotal),
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,
  };
}

module.exports = { round2, calculateBillTotals };
