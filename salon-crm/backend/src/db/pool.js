'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true')
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '10000', 10),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '10000', 10),
});

// Configure session hardening when client connects
pool.on('connect', (client) => {
  // Guard against idle transactions holding row locks indefinitely
  client.query('SET idle_in_transaction_session_timeout = 15000').catch((err) => {
    // Non-fatal if setting fails on certain postgres variants
  });
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;
