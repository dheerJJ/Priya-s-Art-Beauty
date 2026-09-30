'use strict';
require('dotenv').config();
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query('BEGIN');

    // 001 - Enable extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 002 - Salons table FIRST (referenced by users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS salons (
        id              SERIAL PRIMARY KEY,
        name            VARCHAR(200) NOT NULL,
        address         TEXT,
        phone           VARCHAR(20),
        email           VARCHAR(255),
        tax_number      VARCHAR(50),
        invoice_prefix  VARCHAR(20) NOT NULL DEFAULT 'SALON',
        tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
        currency        VARCHAR(5) NOT NULL DEFAULT 'INR',
        logo_url        TEXT,
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        invoice_footer  TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  [1/12] salons table OK');

    // 003 - Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        salon_id      INTEGER,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Add salon_id column if it doesn't exist (existing DB)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS salon_id INTEGER;
    `);
    // Add FK constraint if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_users_salon' AND table_name = 'users'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT fk_users_salon
            FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL;
        END IF;
      END$$;
    `);
    console.log('  [2/12] users table OK');

    // 004 - Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id          SERIAL PRIMARY KEY,
        salon_id    INTEGER NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
        name        VARCHAR(100) NOT NULL,
        phone       VARCHAR(20) NOT NULL,
        email       VARCHAR(255),
        notes       TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_salon_id ON customers(salon_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);`);
    console.log('  [3/12] customers table OK');

    // 005 - Services table
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id               SERIAL PRIMARY KEY,
        salon_id         INTEGER NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
        name             VARCHAR(200) NOT NULL,
        category         VARCHAR(100),
        price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
        duration_minutes INTEGER,
        description      TEXT,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_services_salon_id ON services(salon_id);`);
    console.log('  [4/12] services table OK');

    // 006 - Invoice sequences
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        salon_id  INTEGER PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
        year      INTEGER NOT NULL,
        last_seq  INTEGER NOT NULL DEFAULT 0
      );
    `);
    console.log('  [5/12] invoice_sequences table OK');

    // 007 - Bills table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id              SERIAL PRIMARY KEY,
        salon_id        INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
        customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
        invoice_no      VARCHAR(50) NOT NULL UNIQUE,
        subtotal        NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
        discount        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
        discount_type   VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percent')),
        tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
        tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
        total           NUMERIC(10,2) NOT NULL CHECK (total >= 0),
        payment_method  VARCHAR(30) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'other')),
        payment_status  VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
        notes           TEXT,
        status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'refunded')),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bills_salon_id ON bills(salon_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bills_invoice_no ON bills(invoice_no);`);
    console.log('  [6/12] bills table OK');

    // 008 - Bill items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bill_items (
        id            SERIAL PRIMARY KEY,
        bill_id       INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        service_id    INTEGER REFERENCES services(id) ON DELETE SET NULL,
        service_name  VARCHAR(200) NOT NULL,
        category      VARCHAR(100),
        qty           INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
        unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
        line_total    NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);`);
    console.log('  [7/12] bill_items table OK');

    // 009 - Invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id               SERIAL PRIMARY KEY,
        bill_id          INTEGER NOT NULL UNIQUE REFERENCES bills(id) ON DELETE CASCADE,
        pdf_path         TEXT,
        pdf_url          TEXT,
        generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        generation_error TEXT,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  [8/12] invoices table OK');

    // 010 - WhatsApp messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id               SERIAL PRIMARY KEY,
        bill_id          INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        salon_id         INTEGER NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
        recipient_phone  VARCHAR(20) NOT NULL,
        template_name    VARCHAR(100),
        meta_message_id  VARCHAR(255) UNIQUE,
        status           VARCHAR(20) NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
        error_message    TEXT,
        error_code       VARCHAR(50),
        attempt_count    INTEGER NOT NULL DEFAULT 0,
        sent_at          TIMESTAMPTZ,
        delivered_at     TIMESTAMPTZ,
        read_at          TIMESTAMPTZ,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wa_messages_bill_id ON whatsapp_messages(bill_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wa_messages_meta_id ON whatsapp_messages(meta_message_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wa_messages_salon_id ON whatsapp_messages(salon_id);`);
    console.log('  [9/12] whatsapp_messages table OK');

    // 011 - Audit logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          SERIAL PRIMARY KEY,
        salon_id    INTEGER REFERENCES salons(id) ON DELETE SET NULL,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id   INTEGER,
        metadata    JSONB,
        ip_address  VARCHAR(45),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_salon_id ON audit_logs(salon_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);`);
    console.log('  [10/12] audit_logs table OK');

    // 012 - Update timestamp trigger function (with explicit search_path)
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
      SECURITY INVOKER
      SET search_path = public, pg_temp;
    `);

    // Apply triggers to all tables with updated_at
    const triggerTables = ['users', 'salons', 'customers', 'services', 'bills', 'invoices', 'whatsapp_messages'];
    for (const tbl of triggerTables) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_${tbl}'
          ) THEN
            CREATE TRIGGER set_updated_at_${tbl}
            BEFORE UPDATE ON ${tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          END IF;
        END$$;
      `);
    }
    console.log('  [11/12] triggers OK');

    await client.query('COMMIT');
    console.log('  [12/12] transaction committed');
    console.log('✓ All migrations complete');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrate;
