const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { getMessages, sendMessage, deleteMessage, reactToMessage, pinMessage } = require('../controllers/messageController');
const { Message, User } = require('../models');
const { Op } = require('sequelize');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const myId = req.user.id;

    // Find all messages involving this user
    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ senderId: myId }, { receiverId: myId }],
        deletedForEveryone: false,
        groupId: null,
      },
      order: [['createdAt', 'DESC']],
    });

    // Build unique conversation list
    const seen = new Map();
    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
      if (!otherId) continue;
      if (!seen.has(otherId)) {
        seen.set(otherId, {
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
        });
      }
    }

    if (seen.size === 0) return res.json([]);

    // Fetch user details for each conversation
    const userIds = Array.from(seen.keys());
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
    });

    const conversations = users.map(u => ({
      ...u.toJSON(),
      lastMessage: seen.get(u.id)?.lastMessage,
      lastMessageTime: seen.get(u.id)?.lastMessageTime,
    })).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(conversations);
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

router.get('/:userId', auth, getMessages);
router.post('/', auth, upload.single('media'), sendMessage);
router.delete('/:id', auth, deleteMessage);
router.post('/:id/react', auth, reactToMessage);
router.post('/:id/pin', auth, pinMessage);

module.exports = router;
