const express = require('express');
const router = express.Router();
const { createPayment, listPayments } = require('../controllers/payments.controller');

router.post('/', createPayment);
router.get('/', listPayments);

module.exports = router;
