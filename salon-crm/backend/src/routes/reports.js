'use strict';
const express = require('express');
const { getSalesReport, getDashboardStats, getWhatsAppLogs } = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesReport);
router.get('/whatsapp-logs', getWhatsAppLogs);

module.exports = router;
