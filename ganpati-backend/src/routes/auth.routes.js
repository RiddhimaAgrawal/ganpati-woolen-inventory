
const express = require('express');
const router = express.Router();

const {
  login,
  me,
  changePassword,
} = require('../controllers/auth.controller');

const { requireAuth } = require('../auth/middleware');

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;
