'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create default salon
    const salonResult = await client.query(`
      INSERT INTO salons (name, address, phone, email, invoice_prefix, tax_rate, currency)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      "Priya's Art Beauty & Makeup Academy",
      '123 Main Road, City Center - 560034',
      '+91 98765 43210',
      'contact@priyasbeautyacademy.com',
      'PRIYA',
      0,
      'INR'
    ]);

    let salonId;
    if (salonResult.rows.length > 0) {
      salonId = salonResult.rows[0].id;
    } else {
      const existing = await client.query('SELECT id FROM salons LIMIT 1');
      salonId = existing.rows[0]?.id;
    }

    if (!salonId) {
      throw new Error('Could not create or find salon');
    }

    // 2. Create admin user
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role, salon_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        salon_id = EXCLUDED.salon_id
    `, ['Admin User', 'admin@glamoursalon.in', adminPasswordHash, 'admin', salonId, true]);

    // 3. Create staff user
    const staffPasswordHash = await bcrypt.hash('Staff@123', 12);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role, salon_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        salon_id = EXCLUDED.salon_id
    `, ['Staff Member', 'staff@glamoursalon.in', staffPasswordHash, 'staff', salonId, true]);

    // 4. Create service categories and services
    const services = [
      { name: 'Haircut (Men)', category: 'Hair', price: 300 },
      { name: 'Haircut (Women)', category: 'Hair', price: 500 },
      { name: 'Beard Trim', category: 'Beard', price: 150 },
      { name: 'Beard Shaping', category: 'Beard', price: 200 },
      { name: 'Hair Wash', category: 'Hair', price: 150 },
      { name: 'Hair Colour', category: 'Hair', price: 800 },
      { name: 'Highlights', category: 'Hair', price: 1500 },
      { name: 'Facial', category: 'Skin', price: 600 },
      { name: 'Cleanup', category: 'Skin', price: 400 },
      { name: 'Manicure', category: 'Nails', price: 350 },
      { name: 'Pedicure', category: 'Nails', price: 450 },
      { name: 'Head Massage', category: 'Massage', price: 250 },
      { name: 'Full Body Massage', category: 'Massage', price: 1200 },
      { name: 'Eyebrow Threading', category: 'Threading', price: 50 },
      { name: 'Upper Lip Threading', category: 'Threading', price: 30 },
      { name: 'Waxing (Full Arms)', category: 'Waxing', price: 300 },
      { name: 'Waxing (Full Legs)', category: 'Waxing', price: 400 },
    ];

    for (const svc of services) {
      await client.query(`
        INSERT INTO services (salon_id, name, category, price, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT DO NOTHING
      `, [salonId, svc.name, svc.category, svc.price]);
    }

    // 5. Create test customers
    const customers = [
      { name: 'Rahul Sharma', phone: '919876543210', email: 'rahul@example.com' },
      { name: 'Priya Patel', phone: '919845012345', email: 'priya@example.com' },
      { name: 'Arjun Kumar', phone: '919900112233', email: null },
      { name: 'Test Customer', phone: '919999999999', email: null },
    ];

    for (const cust of customers) {
      await client.query(`
        INSERT INTO customers (salon_id, name, phone, email, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT DO NOTHING
      `, [salonId, cust.name, cust.phone, cust.email]);
    }

    // 6. Initialize invoice sequence
    await client.query(`
      INSERT INTO invoice_sequences (salon_id, year, last_seq)
      VALUES ($1, EXTRACT(YEAR FROM NOW())::INT, 0)
      ON CONFLICT (salon_id) DO NOTHING
    `, [salonId]);

    await client.query('COMMIT');
    console.log('✓ Seed data created successfully');
    console.log('  Admin: admin@glamoursalon.in / Admin@123');
    console.log('  Staff: staff@glamoursalon.in / Staff@123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seed;
