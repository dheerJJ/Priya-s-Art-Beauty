'use strict';
const fetch = require('node-fetch');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { processPhone } = require('../utils/phoneUtils');

const META_API_VERSION = 'v20.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Check if WhatsApp integration is configured.
 */
function isWhatsAppConfigured() {
  return !!(
    process.env.META_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.META_ACCESS_TOKEN.length > 10
  );
}

/**
 * Send an invoice via WhatsApp using the Meta Cloud API.
 * Sends a text message with invoice summary + optional document attachment.
 *
 * @param {Object} params
 * @param {number} params.billId
 * @param {number} params.salonId
 * @param {string} params.recipientPhone - Raw phone number
 * @param {Object} params.billData - Bill details for message body
 * @param {string} [params.pdfPath] - Path to PDF file (optional document send)
 * @param {string} [params.templateName] - WhatsApp template name (optional)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendWhatsAppInvoice({
  billId,
  salonId,
  recipientPhone,
  billData,
  _pdfPath,
  templateName,
}) {
  // Validate and normalize phone
  const { normalized: phone, valid, reason } = processPhone(recipientPhone);
  if (!valid) {
    logger.warn('Invalid phone for WhatsApp:', { billId, recipientPhone, reason });
    await recordWhatsAppMessage({
      billId,
      salonId,
      recipientPhone: recipientPhone || 'unknown',
      status: 'failed',
      errorMessage: `Invalid phone number: ${reason}`,
    });
    return { success: false, error: `Invalid phone number: ${reason}` };
  }

  // Record as queued
  const msgId = await recordWhatsAppMessage({
    billId,
    salonId,
    recipientPhone: phone,
    templateName: templateName || 'invoice_text',
    status: 'queued',
  });

  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    logger.warn('WhatsApp not configured - message logged as pending', { billId });
    await updateWhatsAppMessageStatus(msgId, 'failed', 'WhatsApp credentials not configured');
    return {
      success: false,
      error: 'WhatsApp integration not configured. Please add credentials in Settings.',
    };
  }

  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    // Build message body
    const messageBody = buildMessageBody(billData, phone);

    const response = await fetch(
      `${META_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
        timeout: 15000,
      }
    );

    const responseData = await response.json();

    if (!response.ok || responseData.error) {
      const errorMsg = responseData.error?.message || `HTTP ${response.status}`;
      const errorCode = responseData.error?.code || String(response.status);

      logger.error('WhatsApp API error:', {
        billId,
        status: response.status,
        errorCode,
        // Do NOT log access tokens
      });

      await updateWhatsAppMessageStatus(msgId, 'failed', errorMsg, errorCode);
      return { success: false, error: `WhatsApp delivery failed: ${errorMsg}` };
    }

    // Extract message ID from response
    const metaMessageId = responseData.messages?.[0]?.id;
    logger.info('WhatsApp message sent', { billId, metaMessageId });

    await updateWhatsAppMessageWithMetaId(msgId, metaMessageId, 'sent');

    return { success: true, messageId: metaMessageId };
  } catch (err) {
    const errorMsg = err.type === 'request-timeout'
      ? 'WhatsApp API request timed out'
      : err.message;

    logger.error('WhatsApp send error:', { billId, error: err.message });
    await updateWhatsAppMessageStatus(msgId, 'failed', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Build the WhatsApp message body (text message with invoice details).
 * Uses a simple text message when no approved template is configured.
 */
function buildMessageBody(billData, toPhone) {
  const {
    customer_name,
    salon_name,
    invoice_no,
    total,
    payment_method,
    currency = 'INR',
  } = billData;

  const totalFormatted = `${currency === 'INR' ? 'Rs.' : currency} ${Number(total).toFixed(2)}`;
  const payMethod = (payment_method || 'cash').toUpperCase();

  // Text message (works without template approval for testing)
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone,
    type: 'text',
    text: {
      preview_url: false,
      body: `Hello ${customer_name || 'Valued Customer'},\n\nThank you for visiting ${salon_name || 'our salon'}!\n\nYour invoice details:\n• Invoice No: ${invoice_no}\n• Total Amount: ${totalFormatted}\n• Payment: ${payMethod}\n\nYour invoice PDF has been generated. Please visit us again!\n\n_${salon_name || 'Salon'}_`,
    },
  };
}

/**
 * Record a new WhatsApp message in the database.
 */
async function recordWhatsAppMessage({ billId, salonId, recipientPhone, templateName, status, errorMessage }) {
  const result = await pool.query(`
    INSERT INTO whatsapp_messages
      (bill_id, salon_id, recipient_phone, template_name, status, error_message, attempt_count, sent_at)
    VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
    RETURNING id
  `, [billId, salonId, recipientPhone, templateName || null, status, errorMessage || null]);

  return result.rows[0]?.id;
}

/**
 * Update a WhatsApp message status.
 */
async function updateWhatsAppMessageStatus(id, status, errorMessage, errorCode) {
  await pool.query(`
    UPDATE whatsapp_messages
    SET status = $1, error_message = $2, error_code = $3, updated_at = NOW()
    WHERE id = $4
  `, [status, errorMessage || null, errorCode || null, id]);
}

/**
 * Update a WhatsApp message with Meta's message ID after successful send.
 */
async function updateWhatsAppMessageWithMetaId(id, metaMessageId, status) {
  await pool.query(`
    UPDATE whatsapp_messages
    SET meta_message_id = $1, status = $2, sent_at = NOW(), updated_at = NOW()
    WHERE id = $3
  `, [metaMessageId, status, id]);
}

/**
 * Process an incoming webhook status update from Meta.
 * Idempotent - safe to call multiple times with same data.
 */
async function processWebhookStatus(statusUpdate) {
  const { id: metaMessageId, status, timestamp } = statusUpdate;

  if (!metaMessageId || !status) {
    logger.warn('Invalid webhook status update:', { statusUpdate });
    return;
  }

  const allowedStatuses = ['sent', 'delivered', 'read', 'failed'];
  if (!allowedStatuses.includes(status)) {
    logger.info('Ignoring unknown webhook status:', { status, metaMessageId });
    return;
  }

  const ts = timestamp ? new Date(Number(timestamp) * 1000) : new Date();

  let updateQuery;
  const params = [status, ts, metaMessageId];

  if (status === 'delivered') {
    updateQuery = `
      UPDATE whatsapp_messages
      SET status = $1, delivered_at = $2, updated_at = NOW()
      WHERE meta_message_id = $3
        AND status NOT IN ('read')
    `;
  } else if (status === 'read') {
    updateQuery = `
      UPDATE whatsapp_messages
      SET status = $1, read_at = $2, delivered_at = COALESCE(delivered_at, $2), updated_at = NOW()
      WHERE meta_message_id = $3
    `;
  } else if (status === 'failed') {
    const errorInfo = statusUpdate.errors?.[0];
    updateQuery = `
      UPDATE whatsapp_messages
      SET status = $1, updated_at = NOW(), error_message = $4, error_code = $5
      WHERE meta_message_id = $3
    `;
    params.push(errorInfo?.message || 'Delivery failed', errorInfo?.code || null);
  } else {
    updateQuery = `
      UPDATE whatsapp_messages
      SET status = $1, updated_at = NOW()
      WHERE meta_message_id = $3
        AND status = 'queued'
    `;
  }

  const result = await pool.query(updateQuery, params);
  if (result.rowCount > 0) {
    logger.info('WhatsApp status updated:', { metaMessageId, status });
  }
}

/**
 * Retry sending WhatsApp for a bill.
 */
async function retryWhatsApp(billId, salonId) {
  // Increment attempt count on the latest message for this bill and salon
  await pool.query(`
    UPDATE whatsapp_messages
    SET attempt_count = attempt_count + 1, status = 'queued', error_message = NULL, updated_at = NOW()
    WHERE id = (
      SELECT id FROM whatsapp_messages
      WHERE bill_id = $1 AND salon_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    )
  `, [billId, salonId]);
}

/**
 * Send a test WhatsApp message to verify integration.
 */
async function sendTestMessage({ recipientPhone, salonName }) {
  if (!isWhatsAppConfigured()) {
    return {
      success: false,
      error: 'WhatsApp integration not configured.',
    };
  }

  const { normalized: phone, valid, reason } = processPhone(recipientPhone);
  if (!valid) {
    return { success: false, error: `Invalid phone number: ${reason}` };
  }

  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    const messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: `Hello! This is a test notification from ${salonName || "Priya's Art Beauty & Makeup Academy"}. Your WhatsApp Business billing connection is active and operational.`,
      },
    };

    const response = await fetch(
      `${META_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
        timeout: 15000,
      }
    );

    const responseData = await response.json();
    if (!response.ok || responseData.error) {
      const errorMsg = responseData.error?.message || `HTTP ${response.status}`;
      return { success: false, error: `WhatsApp delivery failed: ${errorMsg}` };
    }

    const metaMessageId = responseData.messages?.[0]?.id;
    return { success: true, messageId: metaMessageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWhatsAppInvoice,
  sendTestMessage,
  processWebhookStatus,
  isWhatsAppConfigured,
  retryWhatsApp,
};
