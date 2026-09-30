'use strict';
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

/**
 * GET /api/settings/salon
 */
async function getSalonSettings(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, address, phone, email, tax_number, invoice_prefix,
              tax_rate, currency, logo_url, whatsapp_enabled, invoice_footer
       FROM salons WHERE id = $1`,
      [req.salonId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Salon not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/settings/salon
 */
async function updateSalonSettings(req, res, next) {
  try {
    const {
      name, address, phone, email, tax_number,
      invoice_prefix, tax_rate, currency, invoice_footer, whatsapp_enabled,
    } = req.body;

    const result = await pool.query(`
      UPDATE salons
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          tax_number = COALESCE($5, tax_number),
          invoice_prefix = COALESCE($6, invoice_prefix),
          tax_rate = COALESCE($7, tax_rate),
          currency = COALESCE($8, currency),
          invoice_footer = COALESCE($9, invoice_footer),
          whatsapp_enabled = COALESCE($10, whatsapp_enabled),
          updated_at = NOW()
      WHERE id = $11
      RETURNING id, name, address, phone, email, tax_number, invoice_prefix,
                tax_rate, currency, logo_url, whatsapp_enabled, invoice_footer
    `, [
      name?.trim(),
      address?.trim(),
      phone?.trim(),
      email?.trim(),
      tax_number?.trim(),
      invoice_prefix?.trim()?.toUpperCase(),
      tax_rate !== undefined ? Number(tax_rate) : undefined,
      currency?.trim()?.toUpperCase(),
      invoice_footer?.trim(),
      whatsapp_enabled,
      req.salonId,
    ]);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type)
       VALUES ($1, $2, 'settings_updated', 'salon')`,
      [req.salonId, req.user.id]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/settings/staff (admin only)
 */
async function listStaff(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role, is_active, created_at
      FROM users
      WHERE salon_id = $1
      ORDER BY role ASC, name ASC
    `, [req.salonId]);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/settings/staff (admin only)
 */
async function createStaff(req, res, next) {
  try {
    const { name, email, password, role = 'staff' } = req.body;

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, salon_id, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, name, email, role, is_active, created_at
    `, [name.trim(), email.toLowerCase().trim(), hash, role, req.salonId]);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'staff_created', 'user', $3)`,
      [req.salonId, req.user.id, result.rows[0].id]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/settings/staff/:id (admin only)
 */
async function updateStaff(req, res, next) {
  try {
    const { id } = req.params;
    const { name, role, is_active, password } = req.body;

    const check = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1 AND salon_id = $2',
      [id, req.salonId]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const currentStaff = check.rows[0];

    // Prevent deactivating or demoting the last active admin
    if (
      currentStaff.role === 'admin' &&
      (is_active === false || (role && role !== 'admin'))
    ) {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE salon_id = $1 AND role = 'admin' AND is_active = true AND id != $2",
        [req.salonId, id]
      );
      if (parseInt(adminCountRes.rows[0].count) === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate or demote the last remaining active administrator',
        });
      }
    }

    let passwordUpdate = '';
    const params = [name?.trim(), role, is_active, id, req.salonId];

    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(password, 12);
      passwordUpdate = ', password_hash = $6';
      params.push(hash);
    }

    const result = await pool.query(`
      UPDATE users
      SET name = COALESCE($1, name),
          role = COALESCE($2, role),
          is_active = COALESCE($3, is_active)
          ${passwordUpdate},
          updated_at = NOW()
      WHERE id = $4 AND salon_id = $5
      RETURNING id, name, email, role, is_active
    `, params);

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/settings/whatsapp-status
 */
async function getWhatsAppStatus(req, res, next) {
  try {
    const { isWhatsAppConfigured } = require('../services/whatsappService');
    const configured = isWhatsAppConfigured();

    const salonRes = await pool.query(
      'SELECT whatsapp_enabled FROM salons WHERE id = $1',
      [req.salonId]
    );

    // Recent WA messages
    const msgRes = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM whatsapp_messages WHERE salon_id = $1
      GROUP BY status
    `, [req.salonId]);

    return res.json({
      success: true,
      data: {
        configured,
        enabled: salonRes.rows[0]?.whatsapp_enabled || false,
        phone_number_id_set: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
        message_stats: msgRes.rows,
        webhook_url: `${process.env.PUBLIC_API_URL}/api/webhooks/whatsapp`,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSalonSettings, updateSalonSettings, listStaff, createStaff, updateStaff, getWhatsAppStatus };
