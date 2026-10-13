const express = require('express');
const router = express.Router();
const { listUsers, createUser, resetPassword, deleteUser } = require('../controllers/users.controller');
const { requireAdmin } = require('../auth/middleware');

router.use(requireAdmin);
router.get('/', listUsers);
router.post('/', createUser);
router.post('/:id/reset-password', resetPassword);
router.delete('/:id', deleteUser);

module.exports = router;
