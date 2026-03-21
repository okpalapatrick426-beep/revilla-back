// routes/users.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateLocationSharing, searchUsers, getAllUsers } = require('../controllers/userController');
const { auth } = require('../middleware/auth');

// IMPORTANT: /me and /search must come BEFORE /:id
// otherwise Express matches "me" and "search" as an :id param
router.get('/all', auth, getAllUsers);
router.get('/search', auth, searchUsers);
router.put('/me', auth, updateProfile);
router.put('/me/location', auth, updateLocationSharing);
router.get('/:id', auth, getProfile);

module.exports = router;
