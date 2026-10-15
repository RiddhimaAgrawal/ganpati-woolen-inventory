const express = require('express');
const router = express.Router();
const { createRawImport, listRawImports, updateRawImport, deleteRawImport } = require('../controllers/rawImports.controller');

router.post('/', createRawImport);
router.get('/', listRawImports);
router.put('/:id', updateRawImport);
router.delete('/:id', deleteRawImport);

module.exports = router;
