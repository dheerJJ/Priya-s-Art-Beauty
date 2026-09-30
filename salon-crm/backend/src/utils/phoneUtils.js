'use strict';
/**
 * Phone number utilities for WhatsApp
 * All WhatsApp numbers must be E.164 format without '+': e.g. 919876543210
 */

/**
 * Normalize a phone number to E.164 without '+' sign.
 * Handles Indian numbers specifically but is general-purpose.
 */
function normalizePhone(phone) {
  if (!phone) return null;

  // Remove everything except digits
  let digits = phone.replace(/\D/g, '');

  // Handle Indian numbers: if 10 digits starting with 6-9, prepend 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = '91' + digits;
  }

  // If it starts with 0, remove the 0 and prepend 91
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.slice(1);
  }

  return digits;
}

/**
 * Validate that a normalized phone number is plausibly valid for WhatsApp
 */
function validatePhone(normalized) {
  if (!normalized) return { valid: false, reason: 'Phone number is required' };

  // Must be 7–15 digits (E.164 without +)
  if (!/^\d{7,15}$/.test(normalized)) {
    return { valid: false, reason: 'Phone number must be 7–15 digits' };
  }

  // Must not be all zeros
  if (/^0+$/.test(normalized)) {
    return { valid: false, reason: 'Phone number cannot be all zeros' };
  }

  return { valid: true };
}

/**
 * Normalize and validate a phone number.
 * Returns { normalized, valid, reason }
 */
function processPhone(phone) {
  const normalized = normalizePhone(phone);
  const { valid, reason } = validatePhone(normalized);
  return { normalized, valid, reason };
}

module.exports = { normalizePhone, validatePhone, processPhone };
