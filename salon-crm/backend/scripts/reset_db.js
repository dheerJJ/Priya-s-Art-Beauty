'use strict';
require('dotenv').config();
const pool = require('../src/db/pool');

const TABLES = [
  'audit_logs',
  'whatsapp_messages',
  'invoices',
  'bill_items',
  'bills',
  'invoice_sequences',
  'services',
  'customers',
  'users',
  'salons',
];

async function clearDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connecting to database to clear tables...');
    await client.query('BEGIN');

    // Truncate all tables and reset serial sequences in one cascade operation
    const truncateSql = `TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE;`;
    await client.query(truncateSql);

    await client.query('COMMIT');
    console.log('✓ Successfully cleared all tables and reset sequences:');
    for (const tbl of TABLES) {
      console.log(`  - ${tbl}: EMPTY (sequences reset)`);
    }

    // Verify row counts are 0
    console.log('\nVerification:');
    for (const tbl of TABLES) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM ${tbl}`);
      console.log(`  - ${tbl}: ${res.rows[0].count} rows`);
    }

    console.log('\n✓ Database is now completely empty.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to clear database:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

clearDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
