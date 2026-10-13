const express = require('express');
const router = express.Router();
const { createCustomer, listCustomers } = require('../controllers/customers.controller');

router.post('/', createCustomer);
router.get('/', listCustomers);

module.exports = router;
