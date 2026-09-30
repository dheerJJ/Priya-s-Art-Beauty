'use strict';

/**
 * Generate a unique, sequential invoice number for a salon.
 * Format: {PREFIX}-{YEAR}-{NNNNNN}
 * Uses a locked update on invoice_sequences to be safe under concurrency.
 */
async function generateInvoiceNumber(salonId, client) {
  const year = new Date().getFullYear();

  // Lock the row and get next sequence number atomically
  const result = await client.query(`
    INSERT INTO invoice_sequences (salon_id, year, last_seq)
    VALUES ($1, $2, 1)
    ON CONFLICT (salon_id) DO UPDATE
      SET last_seq = CASE
        WHEN invoice_sequences.year = $2 THEN invoice_sequences.last_seq + 1
        ELSE 1
      END,
      year = $2
    RETURNING last_seq, year
  `, [salonId, year]);

  const { last_seq, year: seqYear } = result.rows[0];

  // Get salon prefix
  const salonResult = await client.query(
    'SELECT invoice_prefix FROM salons WHERE id = $1',
    [salonId]
  );
  const prefix = salonResult.rows[0]?.invoice_prefix || 'SALON';

  return `${prefix}-${seqYear}-${String(last_seq).padStart(6, '0')}`;
}

module.exports = { generateInvoiceNumber };
