'use strict';
require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  try {
    const res = await pool.query(
      `UPDATE salons 
       SET name = $1, invoice_prefix = $2, updated_at = NOW() 
       RETURNING id, name, invoice_prefix, phone, email`,
      ["Priya's Art Beauty & Makeup Academy", 'PRIYA']
    );
    console.log('Successfully updated salon:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update salon:', err);
    process.exit(1);
  }
}

main();
