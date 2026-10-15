const express = require('express');
const router = express.Router();
const { createProcessingBatch, listProcessingBatches, updateProcessingBatch, deleteProcessingBatch } = require('../controllers/processing.controller');

router.post('/', createProcessingBatch);
router.get('/', listProcessingBatches);
router.put('/:id', updateProcessingBatch);
router.delete('/:id', deleteProcessingBatch);

module.exports = router;
