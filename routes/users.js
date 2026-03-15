const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { getProfile, updateProfile, updateLocationSharing, searchUsers, getAllUsers } = require('../controllers/userController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/all', auth, getAllUsers);
router.get('/search', auth, searchUsers);
router.put('/profile', auth, upload.single('avatar'), updateProfile);
router.put('/location', auth, updateLocationSharing);
router.get('/:id', auth, getProfile);

module.exports = router;
