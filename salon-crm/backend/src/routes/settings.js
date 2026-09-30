'use strict';
const express = require('express');
const { body, param } = require('express-validator');
const {
  getSalonSettings, updateSalonSettings,
  listStaff, createStaff, updateStaff,
  getWhatsAppStatus,
} = require('../controllers/settingsController');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// Salon settings (admin only for write)
router.get('/salon', getSalonSettings);
router.put('/salon', requireRole('admin'), [
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be 0-100'),
  body('invoice_prefix').optional().trim().isAlphanumeric().isLength({ max: 20 }),
], validate, updateSalonSettings);

// Staff management (admin only)
router.get('/staff', requireRole('admin'), listStaff);
router.post('/staff', requireRole('admin'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be admin or staff'),
], validate, createStaff);
router.put('/staff/:id', requireRole('admin'), [
  param('id').isInt({ min: 1 }).withMessage('Valid user ID required'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be admin or staff'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, updateStaff);

// WhatsApp status
router.get('/whatsapp-status', getWhatsAppStatus);

module.exports = router;
