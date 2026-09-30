'use strict';
const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { createBill, listBills, getBill, resendWhatsApp, downloadPDF } = require('../controllers/billController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

const resendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { success: false, message: 'Too many WhatsApp resend requests. Please wait before retrying.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.qty').optional().isInt({ min: 1, max: 1000 }).withMessage('Quantity must be between 1 and 1000'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
    body('discount_type').optional().isIn(['fixed', 'percent']).withMessage('discount_type must be fixed or percent'),
    body('payment_method').optional().isIn(['cash', 'upi', 'card', 'other']).withMessage('Invalid payment method'),
    body('payment_status').optional().isIn(['paid', 'pending', 'partial']).withMessage('Invalid payment status'),
  ],
  validate,
  createBill
);

router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  listBills
);

router.get('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid bill ID required')],
  validate,
  getBill
);

router.get('/:id/pdf',
  [param('id').isInt({ min: 1 }).withMessage('Valid bill ID required')],
  validate,
  downloadPDF
);

router.post('/:id/resend-whatsapp',
  resendLimiter,
  [param('id').isInt({ min: 1 }).withMessage('Valid bill ID required')],
  validate,
  resendWhatsApp
);

module.exports = router;
