'use strict';

/**
 * Utility functions for database query security, identifier allowlisting,
 * and wildcard escaping.
 */

/**
 * Escape SQL LIKE/ILIKE wildcard characters (% and _) and backslashes.
 * Enforces a maximum input length to prevent denial-of-service via complex pattern searches.
 *
 * @param {string} input - User search string
 * @param {number} [maxLength=100] - Maximum allowed length
 * @returns {string} - Escaped and capped search string
 */
function escapeLikeWildcards(input, maxLength = 100) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Trim and cap length
  const capped = input.trim().slice(0, maxLength);
  // In standard PostgreSQL, backslash is the default escape character for LIKE/ILIKE.
  // We escape backslash first, then % and _
  return capped.replace(/([\\%_])/g, '\\$1');
}

/**
 * Validate an integer ID parameter to guarantee it is a safe positive integer.
 *
 * @param {*} val
 * @returns {number|null} Safe integer or null
 */
function parseSafeInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (!Number.isInteger(num) || num <= 0 || !Number.isSafeInteger(num)) {
    return null;
  }
  return num;
}

/**
 * Validate an identifier against a strict allowlist.
 *
 * @param {string} identifier
 * @param {string[]} allowlist
 * @param {string} defaultValue
 * @returns {string} Safe allowed identifier
 */
function allowlistIdentifier(identifier, allowlist, defaultValue) {
  if (identifier && allowlist.includes(identifier)) {
    return identifier;
  }
  return defaultValue;
}

module.exports = {
  escapeLikeWildcards,
  parseSafeInt,
  allowlistIdentifier,
};
