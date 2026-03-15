const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { register, login, logout, getMe } = require('../controllers/authController');

// Register
router.post('/register', register);

// Login
router.post('/login', login);

// Logout
router.post('/logout', auth, logout);

// Get current user
router.get('/me', auth, getMe);

module.exports = router;