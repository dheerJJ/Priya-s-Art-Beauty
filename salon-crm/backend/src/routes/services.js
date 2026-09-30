'use strict';
const express = require('express');
const { body, param } = require('express-validator');
const { listServices, createService, updateService, deleteService } = require('../controllers/serviceController');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

router.get('/', listServices);

router.post('/',
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Service name is required').isLength({ max: 200 }),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('category').optional().trim().isLength({ max: 100 }),
    body('duration_minutes').optional({ nullable: true }).isInt({ min: 1, max: 1440 }),
  ],
  validate,
  createService
);

router.put('/:id',
  requireRole('admin'),
  [
    param('id').isInt({ min: 1 }).withMessage('Valid service ID required'),
    body('name').optional().trim().notEmpty().isLength({ max: 200 }),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('category').optional().trim().isLength({ max: 100 }),
    body('duration_minutes').optional({ nullable: true }).isInt({ min: 1, max: 1440 }),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  updateService
);

router.delete('/:id',
  requireRole('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Valid service ID required')],
  validate,
  deleteService
);

module.exports = router;
