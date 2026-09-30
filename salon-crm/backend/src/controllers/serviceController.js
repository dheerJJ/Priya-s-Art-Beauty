'use strict';
const pool = require('../db/pool');

/**
 * GET /api/services
 */
async function listServices(req, res, next) {
  try {
    const salonId = req.salonId;
    const { search, category, active } = req.query;

    let query = `
      SELECT id, name, category, price, duration_minutes, description, is_active, created_at
      FROM services
      WHERE salon_id = $1
    `;
    const params = [salonId];
    let paramCount = 1;

    if (active !== undefined) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(active === 'true');
    }

    if (category) {
      paramCount++;
      query += ` AND category ILIKE $${paramCount}`;
      params.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR category ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY category ASC, name ASC';

    const result = await pool.query(query, params);

    // Get distinct categories
    const catResult = await pool.query(
      'SELECT DISTINCT category FROM services WHERE salon_id = $1 AND category IS NOT NULL ORDER BY category',
      [salonId]
    );

    return res.json({
      success: true,
      data: result.rows,
      categories: catResult.rows.map((r) => r.category),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/services
 */
async function createService(req, res, next) {
  try {
    const salonId = req.salonId;
    const { name, category, price, duration_minutes, description } = req.body;

    const result = await pool.query(`
      INSERT INTO services (salon_id, name, category, price, duration_minutes, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, name, category, price, duration_minutes, description, is_active, created_at
    `, [
      salonId,
      name.trim(),
      category?.trim() || null,
      Number(price),
      duration_minutes ? Number(duration_minutes) : null,
      description?.trim() || null,
    ]);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'service_created', 'service', $3)`,
      [salonId, req.user.id, result.rows[0].id]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/services/:id
 */
async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;
    const { name, category, price, duration_minutes, description, is_active } = req.body;

    const check = await pool.query(
      'SELECT id FROM services WHERE id = $1 AND salon_id = $2',
      [id, salonId]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const result = await pool.query(`
      UPDATE services
      SET name = COALESCE($1, name),
          category = COALESCE($2, category),
          price = COALESCE($3, price),
          duration_minutes = COALESCE($4, duration_minutes),
          description = COALESCE($5, description),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
      WHERE id = $7 AND salon_id = $8
      RETURNING id, name, category, price, duration_minutes, description, is_active, updated_at
    `, [
      name?.trim(),
      category?.trim(),
      price !== undefined ? Number(price) : undefined,
      duration_minutes !== undefined ? Number(duration_minutes) : undefined,
      description?.trim(),
      is_active,
      id,
      salonId,
    ]);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'service_updated', 'service', $3)`,
      [salonId, req.user.id, id]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/services/:id (soft delete)
 */
async function deleteService(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;

    const result = await pool.query(
      `UPDATE services SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND salon_id = $2 RETURNING id`,
      [id, salonId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.json({ success: true, message: 'Service deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listServices, createService, updateService, deleteService };
