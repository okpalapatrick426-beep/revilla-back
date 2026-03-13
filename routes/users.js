const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateLocationSharing, searchUsers } = require('../controllers/userController');
const { auth } = require('../middleware/auth');

router.get('/search', auth, searchUsers);
router.get('/:id', auth, getProfile);
router.put('/me', auth, updateProfile);
// User explicitly opts in/out of location sharing
router.put('/me/location', auth, updateLocationSharing);

module.exports = router;
