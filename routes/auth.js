const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { register, login, logout, getMe, easyLogin } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout);
router.get('/me', auth, getMe);
router.post('/easy-login', easyLogin);

module.exports = router;