const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateLocationSharing, searchUsers, getAllUsers } = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/cloudinaryUpload');

router.get('/all', auth, getAllUsers);
router.get('/search', auth, searchUsers);
router.get('/:id', auth, getProfile);
router.put('/me', auth, updateProfile);
router.put('/profile', auth, upload.single('avatar'), updateProfile);
router.put('/me/location', auth, updateLocationSharing);

module.exports = router;
