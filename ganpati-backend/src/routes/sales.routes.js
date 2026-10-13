const express = require('express');
const router = express.Router();
const { createSale, listSales } = require('../controllers/sales.controller');

router.post('/', createSale);
router.get('/', listSales);

module.exports = router;
