'use strict';
const pool = require('../db/pool');

/**
 * GET /api/reports/sales
 * Sales summary report
 */
async function getSalesReport(req, res, next) {
  try {
    const salonId = req.salonId;
    const { from, to, date_from, date_to, period = 'today' } = req.query;

    const queryFrom = date_from || from;
    const queryTo = date_to || to;

    // Determine date range
    let startDate, endDate;
    const now = new Date();

    if (queryFrom && queryTo) {
      startDate = new Date(queryFrom);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(queryTo);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
      }
    }

    const params = [salonId, startDate.toISOString(), endDate.toISOString()];

    // Summary metrics
    const summaryRes = await pool.query(`
      SELECT
        COUNT(*) as bill_count,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(AVG(total), 0) as avg_bill_value,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM bills
      WHERE salon_id = $1
        AND status = 'active'
        AND created_at >= $2
        AND created_at <= $3
    `, params);

    // Payment method breakdown
    const paymentRes = await pool.query(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM bills
      WHERE salon_id = $1 AND status = 'active'
        AND created_at >= $2 AND created_at <= $3
      GROUP BY payment_method
      ORDER BY total DESC
    `, params);

    // Top services
    const servicesRes = await pool.query(`
      SELECT bi.service_name, bi.category,
             COUNT(*) as times_sold,
             SUM(bi.qty) as total_qty,
             COALESCE(SUM(bi.line_total), 0) as total_revenue
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.salon_id = $1 AND b.status = 'active'
        AND b.created_at >= $2 AND b.created_at <= $3
      GROUP BY bi.service_name, bi.category
      ORDER BY total_revenue DESC
      LIMIT 10
    `, params);

    // Daily revenue (for chart)
    const dailyRes = await pool.query(`
      SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as date_str,
             COUNT(*) as bill_count,
             COALESCE(SUM(total), 0) as revenue
      FROM bills
      WHERE salon_id = $1 AND status = 'active'
        AND created_at >= $2 AND created_at <= $3
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')
      ORDER BY date_str ASC
    `, params);

    // WhatsApp stats
    const waRes = await pool.query(`
      SELECT wm.status, COUNT(*) as count
      FROM whatsapp_messages wm
      JOIN bills b ON b.id = wm.bill_id
      WHERE b.salon_id = $1 AND b.created_at >= $2 AND b.created_at <= $3
      GROUP BY wm.status
    `, params);

    // Unique customers in period
    const newCustRes = await pool.query(`
      SELECT COUNT(DISTINCT customer_id) as unique_customers
      FROM bills
      WHERE salon_id = $1 AND status = 'active' AND created_at >= $2 AND created_at <= $3
    `, params);

    let totalWA = 0;
    let deliveredWA = 0;
    for (const r of waRes.rows) {
      const c = parseInt(r.count);
      totalWA += c;
      if (r.status === 'delivered' || r.status === 'read' || r.status === 'sent') {
        deliveredWA += c;
      }
    }
    const waDeliveryRate = totalWA > 0 ? ((deliveredWA / totalWA) * 100).toFixed(0) : '100';

    const sumRow = summaryRes.rows[0];
    const formattedSummary = {
      ...sumRow,
      total_revenue: parseFloat(sumRow.total_revenue),
      total_bills: parseInt(sumRow.bill_count),
      avg_bill: parseFloat(sumRow.avg_bill_value),
      unique_customers: parseInt(newCustRes.rows[0].unique_customers),
      wa_delivery_rate: waDeliveryRate,
    };

    const revenueMap = new Map();
    dailyRes.rows.forEach(r => {
      revenueMap.set(r.date_str, {
        revenue: parseFloat(r.revenue),
        bill_count: parseInt(r.bill_count),
      });
    });

    let chartData = [];
    const loopDate = new Date(startDate);
    const stopDate = new Date(endDate);
    const daySpan = Math.round((stopDate - loopDate) / (1000 * 60 * 60 * 24));

    if (daySpan > 0 && daySpan <= 62) {
      while (loopDate <= stopDate) {
        const y = loopDate.getFullYear();
        const m = String(loopDate.getMonth() + 1).padStart(2, '0');
        const d = String(loopDate.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        const found = revenueMap.get(key) || { revenue: 0, bill_count: 0 };
        chartData.push({
          label: loopDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          date: key,
          revenue: found.revenue,
          bill_count: found.bill_count,
        });
        loopDate.setDate(loopDate.getDate() + 1);
      }
    } else {
      chartData = dailyRes.rows.map(r => {
        const d = new Date(r.date_str + 'T12:00:00Z');
        return {
          label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          date: r.date_str,
          revenue: parseFloat(r.revenue),
          bill_count: parseInt(r.bill_count),
        };
      });
    }

    const formattedTopServices = servicesRes.rows.map(r => ({
      ...r,
      order_count: parseInt(r.times_sold),
      revenue: parseFloat(r.total_revenue),
    }));

    const formattedPaymentBreakdown = paymentRes.rows.map(r => ({
      payment_method: r.payment_method,
      total: parseFloat(r.total),
      count: parseInt(r.count),
    }));

    return res.json({
      success: true,
      data: {
        period: { from: startDate, to: endDate },
        summary: formattedSummary,
        chart_data: chartData,
        payment_breakdown: formattedPaymentBreakdown,
        top_services: formattedTopServices,
        daily_revenue: dailyRes.rows,
        whatsapp_stats: waRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/dashboard
 * Dashboard summary stats
 */
async function getDashboardStats(req, res, next) {
  try {
    const salonId = req.salonId;
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRes, monthRes, totalCustRes, recentBillsRes, recentWARes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as bills, COALESCE(SUM(total), 0) as revenue
        FROM bills WHERE salon_id = $1 AND status = 'active' AND created_at >= $2
      `, [salonId, todayStart.toISOString()]),

      pool.query(`
        SELECT COUNT(*) as bills, COALESCE(SUM(total), 0) as revenue
        FROM bills WHERE salon_id = $1 AND status = 'active' AND created_at >= $2
      `, [salonId, monthStart.toISOString()]),

      pool.query(
        'SELECT COUNT(*) as total FROM customers WHERE salon_id = $1 AND is_active = true',
        [salonId]
      ),

      pool.query(`
        SELECT b.id, b.invoice_no, b.total, b.payment_method, b.payment_status, b.created_at,
               c.name as customer_name, wm.status as whatsapp_status
        FROM bills b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN LATERAL (
          SELECT status FROM whatsapp_messages
          WHERE bill_id = b.id
          ORDER BY created_at DESC
          LIMIT 1
        ) wm ON true
        WHERE b.salon_id = $1 AND b.status = 'active'
        ORDER BY b.created_at DESC LIMIT 10
      `, [salonId]),

      pool.query(`
        SELECT wm.id, wm.recipient_phone, wm.status, wm.created_at, wm.updated_at,
               b.invoice_no, c.name as customer_name
        FROM whatsapp_messages wm
        JOIN bills b ON b.id = wm.bill_id
        LEFT JOIN customers c ON c.id = b.customer_id
        WHERE wm.salon_id = $1
        ORDER BY wm.created_at DESC LIMIT 10
      `, [salonId]),
    ]);

    return res.json({
      success: true,
      data: {
        today: {
          bills: parseInt(todayRes.rows[0].bills),
          revenue: parseFloat(todayRes.rows[0].revenue),
        },
        month: {
          bills: parseInt(monthRes.rows[0].bills),
          revenue: parseFloat(monthRes.rows[0].revenue),
        },
        total_customers: parseInt(totalCustRes.rows[0].total),
        recent_bills: recentBillsRes.rows,
        recent_whatsapp: recentWARes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/whatsapp-logs
 * Filterable WhatsApp message logs with pagination & stats
 */
async function getWhatsAppLogs(req, res, next) {
  try {
    const salonId = req.salonId;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = ['wm.salon_id = $1'];
    const params = [salonId];
    let pc = 1;

    if (status) {
      pc++;
      whereConditions.push(`wm.status = $${pc}`);
      params.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `
      SELECT COUNT(*) as count FROM whatsapp_messages wm WHERE ${whereClause}
    `;

    const dataQuery = `
      SELECT wm.id, wm.bill_id, wm.recipient_phone, wm.status, wm.error_message,
             wm.attempt_count, wm.sent_at, wm.delivered_at, wm.read_at, wm.created_at,
             b.invoice_no, c.name as customer_name
      FROM whatsapp_messages wm
      JOIN bills b ON b.id = wm.bill_id
      LEFT JOIN customers c ON c.id = b.customer_id
      WHERE ${whereClause}
      ORDER BY wm.created_at DESC
      LIMIT $${pc + 1} OFFSET $${pc + 2}
    `;
    params.push(Number(limit), offset);

    // Stats breakdown
    const statsQuery = `
      SELECT status, COUNT(*) as count
      FROM whatsapp_messages
      WHERE salon_id = $1
      GROUP BY status
    `;

    const [dataResult, countResult, statsResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, pc)),
      pool.query(statsQuery, [salonId]),
    ]);

    const stats = { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const r of statsResult.rows) {
      if (stats[r.status] !== undefined) {
        stats[r.status] = parseInt(r.count);
      }
    }

    const total = parseInt(countResult.rows[0].count);

    return res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
      stats,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSalesReport, getDashboardStats, getWhatsAppLogs };

