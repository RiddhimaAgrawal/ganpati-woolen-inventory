const express = require('express');
const router = express.Router();
const { createRawImport, listRawImports } = require('../controllers/rawImports.controller');

router.post('/', createRawImport);
router.get('/', listRawImports);

module.exports = router;
