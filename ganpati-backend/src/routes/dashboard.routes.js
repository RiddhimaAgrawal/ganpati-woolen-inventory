const express = require('express');
const router = express.Router();
const { getStockSummary, getDuesSummary } = require('../controllers/dashboard.controller');

router.get('/stock', getStockSummary);
router.get('/dues', getDuesSummary);

module.exports = router;
