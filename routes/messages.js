const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  getConversation,
  getGroupMessages,
  sendMessage,
  markMessagesRead,
  getConversations,
  deleteMessage,
  reactToMessage,
} = require('../controllers/messageController');

// Memory storage — pipes buffer to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/', 'video/', 'audio/'];
    if (allowed.some(type => file.mimetype.startsWith(type))) cb(null, true);
    else cb(new Error('File type not allowed'), false);
  }
});

router.use(authenticate);

router.get('/conversations', getConversations);
router.get('/:userId', getConversation);
router.get('/group/:groupId', getGroupMessages);
router.post('/', upload.single('media'), sendMessage);
router.patch('/read/:senderId', markMessagesRead);
router.delete('/:id', deleteMessage);
router.post('/:id/react', reactToMessage);

module.exports = router;
