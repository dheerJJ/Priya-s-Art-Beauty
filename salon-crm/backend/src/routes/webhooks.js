'use strict';
const express = require('express');
const { verifyWebhook, handleWebhook } = require('../controllers/webhookController');

const router = express.Router();

// Meta webhook verification (GET) - no auth required
router.get('/whatsapp', verifyWebhook);

// Meta webhook events (POST) - verified via HMAC signature
router.post('/whatsapp', handleWebhook);

module.exports = router;
