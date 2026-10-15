const express = require('express');
const router = express.Router();
const { createCustomer, listCustomers, updateCustomer, deleteCustomer } = require('../controllers/customers.controller');

router.post('/', createCustomer);
router.get('/', listCustomers);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
