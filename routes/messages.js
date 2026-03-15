const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { getMessages, sendMessage, deleteMessage, reactToMessage, pinMessage } = require('../controllers/messageController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/:userId', auth, getMessages);
router.post('/', auth, upload.single('media'), sendMessage);
router.delete('/:id', auth, deleteMessage);
router.post('/:id/react', auth, reactToMessage);
router.post('/:id/pin', auth, pinMessage);

module.exports = router;
