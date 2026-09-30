'use strict';
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { calculateBillTotals } = require('../utils/moneyUtils');
const { generateInvoiceNumber } = require('../services/invoiceNumberService');
const { generateInvoicePDF } = require('../services/pdfService');
const { sendWhatsAppInvoice } = require('../services/whatsappService');

/**
 * POST /api/bills
 * Create a bill with all items, calculate totals server-side, generate invoice, send WhatsApp.
 */
async function createBill(req, res, next) {
  const client = await pool.connect();
  try {
    const salonId = req.salonId;
    const userId = req.user.id;

    const {
      customer_id,
      customer,        // { name, phone, email } for new or walk-in customer
      items,
      discount = 0,
      discount_type = 'fixed',
      payment_method = 'cash',
      payment_status = 'paid',
      notes,
      send_whatsapp = true,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ success: false, message: 'At least one service item is required' });
    }

    // === BEGIN TRANSACTION ===
    await client.query('BEGIN');

    // 1. Resolve customer
    let customerId = customer_id ? Number(customer_id) : null;
    let customerData = null;

    if (customerId) {
      const custRes = await client.query(
        'SELECT id, name, phone, email FROM customers WHERE id = $1 AND salon_id = $2 AND is_active = true',
        [customerId, salonId]
      );
      if (!custRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      customerData = custRes.rows[0];
    } else if (customer) {
      // Walk-in or create new customer
      const { name, phone, email } = customer;
      if (name && phone) {
        const { processPhone } = require('../utils/phoneUtils');
        const { normalized, valid, reason } = processPhone(phone);
        if (!valid) {
          await client.query('ROLLBACK');
          return res.status(422).json({ success: false, message: `Invalid customer phone: ${reason}` });
        }

        // Check if customer already exists
        const existing = await client.query(
          'SELECT id, name, phone, email FROM customers WHERE salon_id = $1 AND phone = $2 AND is_active = true',
          [salonId, normalized]
        );

        if (existing.rows.length > 0) {
          customerData = existing.rows[0];
          customerId = customerData.id;
        } else {
          const newCust = await client.query(`
            INSERT INTO customers (salon_id, name, phone, email, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id, name, phone, email
          `, [salonId, name.trim(), normalized, email?.trim() || null]);
          customerData = newCust.rows[0];
          customerId = customerData.id;
        }
      }
    }

    // 2. Fetch salon data
    const salonRes = await client.query(
      'SELECT name, address, phone, email, tax_number, tax_rate, invoice_prefix, currency, invoice_footer FROM salons WHERE id = $1',
      [salonId]
    );
    const salon = salonRes.rows[0];
    const salonTaxRate = salon?.tax_rate || 0;

    // 3. Validate and enrich items from DB (get authoritative prices)
    const enrichedItems = [];
    for (const item of items) {
      if (!item.service_id && !item.service_name) {
        await client.query('ROLLBACK');
        return res.status(422).json({ success: false, message: 'Each item must have a service_id or service_name' });
      }

      let unitPrice = Number(item.unit_price || item.price || 0);
      let serviceName = item.service_name || item.name;
      let category = item.category || null;

      // If service_id provided, fetch authoritative price from DB
      if (item.service_id) {
        const svcRes = await client.query(
          'SELECT name, category, price FROM services WHERE id = $1 AND salon_id = $2',
          [item.service_id, salonId]
        );
        if (!svcRes.rows.length) {
          await client.query('ROLLBACK');
          return res.status(422).json({
            success: false,
            message: `Service with ID ${item.service_id} not found`,
          });
        }
        // Use DB price as authoritative
        serviceName = svcRes.rows[0].name;
        category = svcRes.rows[0].category;
        unitPrice = Number(svcRes.rows[0].price);
      }

      const qty = Math.max(1, Math.round(Number(item.qty) || 1));

      if (unitPrice < 0) {
        await client.query('ROLLBACK');
        return res.status(422).json({ success: false, message: `Invalid price for item: ${serviceName}` });
      }

      enrichedItems.push({
        service_id: item.service_id || null,
        service_name: serviceName,
        category,
        qty,
        unit_price: unitPrice,
      });
    }

    // 4. Calculate totals SERVER-SIDE
    const { items: calculatedItems, subtotal, discount_amount, tax_amount, total } = calculateBillTotals(
      enrichedItems,
      Number(discount) || 0,
      discount_type,
      salonTaxRate
    );

    // 5. Generate unique invoice number (within transaction - atomic)
    const invoiceNo = await generateInvoiceNumber(salonId, client);

    // 6. Create bill record
    const billRes = await client.query(`
      INSERT INTO bills
        (salon_id, customer_id, created_by, invoice_no, subtotal, discount, discount_type,
         tax_rate, tax_amount, total, payment_method, payment_status, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')
      RETURNING id, invoice_no, subtotal, discount, discount_type, tax_rate, tax_amount, total,
                payment_method, payment_status, notes, status, created_at
    `, [
      salonId, customerId, userId, invoiceNo,
      subtotal, Number(discount) || 0, discount_type,
      salonTaxRate, tax_amount, total,
      payment_method, payment_status, notes?.trim() || null,
    ]);

    const bill = billRes.rows[0];

    // 7. Create bill items
    for (const item of calculatedItems) {
      await client.query(`
        INSERT INTO bill_items (bill_id, service_id, service_name, category, qty, unit_price, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        bill.id, item.service_id, item.service_name, item.category,
        item.qty, item.unit_price, item.line_total,
      ]);
    }

    // 8. COMMIT the financial transaction
    await client.query('COMMIT');
    logger.info('Bill created successfully', { billId: bill.id, invoiceNo });

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'bill_created', 'bill', $3, $4)`,
      [salonId, userId, bill.id, JSON.stringify({ invoice_no: invoiceNo, total })]
    );

    // === POST-TRANSACTION: PDF Generation ===
    let pdfResult = null;
    let pdfError = null;

    const billForPDF = {
      ...bill,
      items: calculatedItems,
      customer_name: customerData?.name || 'Walk-in Customer',
      customer_phone: customerData?.phone || null,
      customer_email: customerData?.email || null,
      salon_name: salon?.name,
      salon_address: salon?.address,
      salon_phone: salon?.phone,
      salon_email: salon?.email,
      salon_tax_number: salon?.tax_number,
      invoice_footer: salon?.invoice_footer,
      currency: salon?.currency || 'INR',
      discount_amount,
      tax_rate: salonTaxRate,
    };

    try {
      pdfResult = await generateInvoicePDF(billForPDF);

      // Record invoice in DB
      await pool.query(`
        INSERT INTO invoices (bill_id, pdf_path, generated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (bill_id) DO UPDATE SET pdf_path = $2, updated_at = NOW()
      `, [bill.id, pdfResult.filename]);
    } catch (pdfErr) {
      pdfError = pdfErr.message;
      logger.error('PDF generation failed after bill creation:', {
        billId: bill.id,
        error: pdfErr.message,
      });
      // Record failure
      await pool.query(`
        INSERT INTO invoices (bill_id, generation_error, generated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (bill_id) DO UPDATE SET generation_error = $2, updated_at = NOW()
      `, [bill.id, pdfErr.message]);
    }

    // === POST-TRANSACTION: WhatsApp ===
    let whatsappResult = null;

    if (send_whatsapp && customerData?.phone) {
      try {
        whatsappResult = await sendWhatsAppInvoice({
          billId: bill.id,
          salonId,
          recipientPhone: customerData.phone,
          billData: {
            customer_name: customerData.name,
            salon_name: salon?.name,
            invoice_no: invoiceNo,
            total,
            payment_method,
            currency: salon?.currency || 'INR',
          },
          pdfPath: pdfResult?.pdfPath,
        });
      } catch (waErr) {
        logger.error('WhatsApp send error (non-fatal):', {
          billId: bill.id,
          error: waErr.message,
        });
        whatsappResult = { success: false, error: waErr.message };
      }
    }

    // Build response
    return res.status(201).json({
      success: true,
      data: {
        ...bill,
        items: calculatedItems,
        customer: customerData,
        invoice: pdfResult ? { filename: pdfResult.filename } : null,
        pdf_error: pdfError,
        whatsapp: whatsappResult,
      },
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    logger.error('Create bill error:', { error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

/**
 * GET /api/bills
 */
async function listBills(req, res, next) {
  try {
    const salonId = req.salonId;
    const { search, page = 1, limit = 20, from, to, payment_method, status = 'active' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let conditions = ['b.salon_id = $1'];
    const params = [salonId];
    let pc = 1;

    if (status) {
      pc++; conditions.push(`b.status = $${pc}`); params.push(status);
    }
    if (from) {
      pc++; conditions.push(`b.created_at >= $${pc}`); params.push(from);
    }
    if (to) {
      pc++; conditions.push(`b.created_at <= $${pc}`); params.push(to);
    }
    if (payment_method) {
      pc++; conditions.push(`b.payment_method = $${pc}`); params.push(payment_method);
    }
    if (search) {
      pc++;
      conditions.push(`(b.invoice_no ILIKE $${pc} OR c.name ILIKE $${pc} OR c.phone ILIKE $${pc})`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT b.id, b.invoice_no, b.subtotal, b.discount, b.tax_amount, b.total,
             b.payment_method, b.payment_status, b.status, b.created_at,
             c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
             wm.status as whatsapp_status,
             i.pdf_path,
             COALESCE((SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id), 0)::int as item_count
      FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN LATERAL (
        SELECT status FROM whatsapp_messages
        WHERE bill_id = b.id
        ORDER BY created_at DESC
        LIMIT 1
      ) wm ON true
      LEFT JOIN invoices i ON i.bill_id = b.id
      WHERE ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${pc + 1} OFFSET $${pc + 2}
    `;
    params.push(Number(limit), offset);

    const countQuery = `
      SELECT COUNT(DISTINCT b.id) FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      WHERE ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, pc)),
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
 * GET /api/bills/:id
 */
async function getBill(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;

    const billRes = await pool.query(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             u.name as created_by_name
      FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN users u ON u.id = b.created_by
      WHERE b.id = $1 AND b.salon_id = $2
    `, [id, salonId]);

    if (!billRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const bill = billRes.rows[0];

    const [itemsRes, invoiceRes, waRes] = await Promise.all([
      pool.query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id', [id]),
      pool.query('SELECT * FROM invoices WHERE bill_id = $1', [id]),
      pool.query('SELECT * FROM whatsapp_messages WHERE bill_id = $1 ORDER BY created_at DESC', [id]),
    ]);

    return res.json({
      success: true,
      data: {
        ...bill,
        items: itemsRes.rows,
        invoice: invoiceRes.rows[0] || null,
        whatsapp_messages: waRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bills/:id/resend-whatsapp
 */
async function resendWhatsApp(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;

    // Get bill with customer and salon info
    const billRes = await pool.query(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone,
             s.name as salon_name, s.currency
      FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN salons s ON s.id = b.salon_id
      WHERE b.id = $1 AND b.salon_id = $2
    `, [id, salonId]);

    if (!billRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const bill = billRes.rows[0];
    if (!bill.customer_phone) {
      return res.status(422).json({ success: false, message: 'No customer phone number on this bill' });
    }

    const result = await sendWhatsAppInvoice({
      billId: bill.id,
      salonId,
      recipientPhone: bill.customer_phone,
      billData: {
        customer_name: bill.customer_name,
        salon_name: bill.salon_name,
        invoice_no: bill.invoice_no,
        total: bill.total,
        payment_method: bill.payment_method,
        currency: bill.currency || 'INR',
      },
    });

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'whatsapp_resent', 'bill', $3)`,
      [salonId, req.user.id, id]
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bills/:id/pdf
 */
async function downloadPDF(req, res, next) {
  try {
    const { id } = req.params;
    const salonId = req.salonId;

    const invoiceRes = await pool.query(`
      SELECT i.pdf_path, b.invoice_no FROM invoices i
      JOIN bills b ON b.id = i.bill_id
      WHERE i.bill_id = $1 AND b.salon_id = $2
    `, [id, salonId]);

    if (!invoiceRes.rows.length || !invoiceRes.rows[0].pdf_path) {
      // Try to regenerate
      return await regeneratePDF(req, res, next, id, salonId);
    }

    const { pdf_path, invoice_no } = invoiceRes.rows[0];
    const { getPDFStream, pdfExists } = require('../services/pdfService');

    if (!pdfExists(pdf_path)) {
      return await regeneratePDF(req, res, next, id, salonId);
    }

    const stream = getPDFStream(pdf_path);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice_no}.pdf"`);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

async function regeneratePDF(req, res, next, billId, salonId) {
  try {
    const billRes = await pool.query(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             s.name as salon_name, s.address as salon_address, s.phone as salon_phone,
             s.email as salon_email, s.tax_number as salon_tax_number,
             s.currency, s.invoice_footer
      FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN salons s ON s.id = b.salon_id
      WHERE b.id = $1 AND b.salon_id = $2
    `, [billId, salonId]);

    if (!billRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const bill = billRes.rows[0];
    const itemsRes = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id', [billId]);

    const pdfResult = await generateInvoicePDF({ ...bill, items: itemsRes.rows });

    await pool.query(`
      INSERT INTO invoices (bill_id, pdf_path, generated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (bill_id) DO UPDATE SET pdf_path = $2, generation_error = NULL, updated_at = NOW()
    `, [billId, pdfResult.filename]);

    const { getPDFStream } = require('../services/pdfService');
    const stream = getPDFStream(pdfResult.filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${bill.invoice_no}.pdf"`);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { createBill, listBills, getBill, resendWhatsApp, downloadPDF };
