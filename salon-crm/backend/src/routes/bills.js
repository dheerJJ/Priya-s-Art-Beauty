'use strict';
const express = require('express');
const { body } = require('express-validator');
const { createBill, listBills, getBill, resendWhatsApp, downloadPDF } = require('../controllers/billController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

router.post('/',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.qty').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
    body('discount_type').optional().isIn(['fixed', 'percent']).withMessage('discount_type must be fixed or percent'),
    body('payment_method').optional().isIn(['cash', 'upi', 'card', 'other']).withMessage('Invalid payment method'),
    body('payment_status').optional().isIn(['paid', 'pending', 'partial']).withMessage('Invalid payment status'),
  ],
  validate,
  createBill
);

router.get('/', listBills);
router.get('/:id', getBill);
router.get('/:id/pdf', downloadPDF);
router.post('/:id/resend-whatsapp', resendWhatsApp);

module.exports = router;
