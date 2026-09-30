'use strict';
const express = require('express');
const { body } = require('express-validator');
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
  ],
  validate,
  createService
);

router.put('/:id',
  requireRole('admin'),
  [
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  ],
  validate,
  updateService
);

router.delete('/:id', requireRole('admin'), deleteService);

module.exports = router;
