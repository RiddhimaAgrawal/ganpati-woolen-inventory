const express = require('express');
const router = express.Router();
const { createSale, listSales, updateSale, deleteSale } = require('../controllers/sales.controller');

router.post('/', createSale);
router.get('/', listSales);
router.put('/:id', updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
