const express = require('express');
const router = express.Router();
const { createProcessingBatch, listProcessingBatches } = require('../controllers/processing.controller');

router.post('/', createProcessingBatch);
router.get('/', listProcessingBatches);

module.exports = router;
