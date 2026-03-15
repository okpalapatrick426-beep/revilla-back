const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/cloudinaryUpload');
const { getProfile, updateProfile, updateLocationSharing, searchUsers, getAllUsers } = require('../controllers/userController');

// Order matters! Specific routes before :id
router.get('/all', auth, getAllUsers);
router.get('/search', auth, searchUsers);
router.put('/profile', auth, uploadAvatar.single('avatar'), updateProfile);
router.put('/location', auth, updateLocationSharing);
router.get('/:id', auth, getProfile);

module.exports = router;
