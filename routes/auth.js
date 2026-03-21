// routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login, easyLogin, logout, getMe } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/easy-login', easyLogin);  // passwordless dev/demo login
router.post('/logout', auth, logout);
router.get('/me', auth, getMe);

module.exports = router;
