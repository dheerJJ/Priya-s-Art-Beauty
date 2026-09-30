'use strict';
const pool = require('../db/pool');
const { processPhone } = require('../utils/phoneUtils');

const { escapeLikeWildcards } = require('../utils/dbUtils');

/**
 * GET /api/customers
 */
async function listCustomers(req, res, next) {
  try {
    const salonId = req.salonId;
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT c.id, c.name, c.phone, c.email, c.notes, c.is_active, c.created_at,
             COUNT(b.id) as bill_count,
             COALESCE(SUM(b.total), 0) as total_spent
      FROM customers c
      LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
      WHERE c.salon_id = $1
    `;
    const params = [salonId];
    let paramCount = 1;

    const safeSearch = search ? escapeLikeWildcards(search, 100) : null;

    if (safeSearch) {
      paramCount++;
      query += ` AND (c.name ILIKE $${paramCount} OR c.phone ILIKE $${paramCount})`;
      params.push(`%${safeSearch}%`);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(Number(limit), offset);

    const countQuery = `
      SELECT COUNT(*) FROM customers c
      WHERE c.salon_id = $1
      ${safeSearch ? `AND (c.name ILIKE $2 OR c.phone ILIKE $2)` : ''}
    `;
    const countParams = safeSearch ? [salonId, `%${safeSearch}%`] : [salonId];

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    return res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(countResult.rows[0].count / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/customers
 */
async function createCustomer(req, res, next) {
  try {
    const salonId = req.salonId;
    const { name, phone, email, notes } = req.body;

    // Normalize and validate phone
    const { normalized, valid, reason } = processPhone(phone);
    if (!valid) {
      return res.status(422).json({ success: false, message: `Invalid phone number: ${reason}` });
    }

    // Check duplicate phone in this salon
    const dupCheck = await pool.query(
      'SELECT id FROM customers WHERE salon_id = $1 AND phone = $2 AND is_active = true',
      [salonId, normalized]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A customer with this phone number already exists',
        customerId: dupCheck.rows[0].id,
      });
    }

    const result = await pool.query(`
      INSERT INTO customers (salon_id, name, phone, email, notes, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, name, phone, email, notes, is_active, created_at
    `, [salonId, name.trim(), normalized, email?.trim() || null, notes?.trim() || null]);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'customer_created', 'customer', $3)`,
      [salonId, req.user.id, result.rows[0].id]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/customers/:id
 */
async function getCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;

    const custResult = await pool.query(`
      SELECT c.id, c.name, c.phone, c.email, c.notes, c.is_active, c.created_at,
             COUNT(b.id) as bill_count,
             COALESCE(SUM(b.total), 0) as total_spent,
             MAX(b.created_at) as last_visit
      FROM customers c
      LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
      WHERE c.id = $1 AND c.salon_id = $2
      GROUP BY c.id
    `, [id, salonId]);

    if (!custResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get recent bills
    const billsResult = await pool.query(`
      SELECT b.id, b.invoice_no, b.total, b.payment_method, b.payment_status, b.created_at,
             wm.status as whatsapp_status
      FROM bills b
      LEFT JOIN LATERAL (
        SELECT status FROM whatsapp_messages
        WHERE bill_id = b.id
        ORDER BY created_at DESC
        LIMIT 1
      ) wm ON true
      WHERE b.customer_id = $1 AND b.salon_id = $2 AND b.status = 'active'
      ORDER BY b.created_at DESC
      LIMIT 10
    `, [id, salonId]);

    return res.json({
      success: true,
      data: {
        ...custResult.rows[0],
        recent_bills: billsResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/customers/:id
 */
async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;
    const { name, phone, email, notes, is_active } = req.body;

    // Check customer belongs to salon
    const check = await pool.query(
      'SELECT id FROM customers WHERE id = $1 AND salon_id = $2',
      [id, salonId]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    let normalizedPhone = undefined;
    if (phone) {
      const { normalized, valid, reason } = processPhone(phone);
      if (!valid) {
        return res.status(422).json({ success: false, message: `Invalid phone number: ${reason}` });
      }
      normalizedPhone = normalized;
    }

    const result = await pool.query(`
      UPDATE customers
      SET name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          notes = COALESCE($4, notes),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6 AND salon_id = $7
      RETURNING id, name, phone, email, notes, is_active, created_at, updated_at
    `, [
      name?.trim(),
      normalizedPhone,
      email?.trim() || null,
      notes?.trim() || null,
      is_active,
      id,
      salonId,
    ]);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'customer_updated', 'customer', $3)`,
      [salonId, req.user.id, id]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/customers/:id (soft delete)
 */
async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;

    const result = await pool.query(
      `UPDATE customers SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND salon_id = $2 RETURNING id`,
      [id, salonId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'customer_deleted', 'customer', $3)`,
      [salonId, req.user.id, id]
    );

    return res.json({ success: true, message: 'Customer deactivated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCustomers, createCustomer, getCustomer, updateCustomer, deleteCustomer };
