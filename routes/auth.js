const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { register, login, logout, getMe } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout);
router.get('/me', auth, getMe);

module.exports = router;
