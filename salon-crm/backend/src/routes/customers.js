'use strict';
const express = require('express');
const { body, query, param } = require('express-validator');
const {
  listCustomers, createCustomer, getCustomer, updateCustomer, deleteCustomer,
} = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

router.get('/',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  listCustomers
);

router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Customer name is required')
      .isLength({ max: 100 }).withMessage('Name too long'),
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format'),
  ],
  validate,
  createCustomer
);

router.get('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid customer ID required')],
  validate,
  getCustomer
);

router.put('/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Valid customer ID required'),
    body('name').optional().trim().notEmpty().isLength({ max: 100 }).withMessage('Name too long'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format'),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  updateCustomer
);

router.delete('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid customer ID required')],
  validate,
  deleteCustomer
);

module.exports = router;
