const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { supabaseSync, getMe } = require('../controllers/authController');

// Supabase magic link sync — called after successful Supabase auth
router.post('/supabase-sync', supabaseSync);

// Get current user (uses our JWT)
router.get('/me', auth, getMe);

module.exports = router;
