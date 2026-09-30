'use strict';
const crypto = require('crypto');
const { processWebhookStatus } = require('../services/whatsappService');
const logger = require('../utils/logger');

/**
 * GET /api/webhooks/whatsapp
 * Webhook verification challenge from Meta
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('WhatsApp webhook verification failed', { mode, tokenMatch: token === verifyToken });
  return res.status(403).json({ success: false, message: 'Verification failed' });
}

/**
 * POST /api/webhooks/whatsapp
 * Process incoming webhook events from Meta
 */
async function handleWebhook(req, res) {
  // Immediately return 200 to Meta - process asynchronously
  res.status(200).json({ status: 'ok' });

  try {
    // Validate signature (HMAC-SHA256)
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) {
        logger.warn('Missing webhook signature header');
        return; // Already responded 200
      }

      const bodyStr = JSON.stringify(req.body);
      const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(bodyStr)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        logger.warn('Invalid webhook signature - possible spoofing attempt');
        return;
      }
    }

    const body = req.body;

    // Process WhatsApp status updates
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // Process status updates
          const statuses = value.statuses || [];
          for (const statusUpdate of statuses) {
            await processWebhookStatus(statusUpdate);
          }

          // Log incoming messages (optional - for audit)
          const messages = value.messages || [];
          for (const message of messages) {
            logger.info('Incoming WhatsApp message (unhandled):', {
              from: message.from,
              type: message.type,
              id: message.id,
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error('Webhook processing error (non-fatal):', { error: err.message });
    // Error is logged but we already responded 200 - Meta does not need to retry
  }
}

module.exports = { verifyWebhook, handleWebhook };
