'use strict';
const express = require('express');
const { body, query } = require('express-validator');
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
    body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email format'),
  ],
  validate,
  createCustomer
);

router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
