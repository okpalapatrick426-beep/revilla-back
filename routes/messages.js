const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { Message, User } = require('../models');
const { Op } = require('sequelize');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /messages/conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const myId = req.user.id;
    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ senderId: myId }, { receiverId: myId }],
        deletedForEveryone: false,
        groupId: null,
        receiverId: { [Op.ne]: null },
      },
      order: [['createdAt', 'DESC']],
    });

    const seen = new Map();
    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
      if (!otherId || seen.has(otherId)) continue;
      seen.set(otherId, { lastMessage: msg.deletedForEveryone ? 'Message deleted' : msg.content, lastMessageTime: msg.createdAt });
    }

    if (seen.size === 0) return res.json([]);

    const users = await User.findAll({
      where: { id: { [Op.in]: Array.from(seen.keys()) } },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
    });

    const convos = users.map(u => ({
      ...u.toJSON(),
      lastMessage: seen.get(u.id)?.lastMessage,
      lastMessageTime: seen.get(u.id)?.lastMessageTime,
    })).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(convos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// GET /messages/:userId
router.get('/:userId', auth, async (req, res) => {
  try {
    const myId = req.user.id;
    const { userId } = req.params;
    const messages = await Message.findAll({
      where: {
        deletedForEveryone: false,
        [Op.or]: [
          { senderId: myId, receiverId: userId },
          { senderId: userId, receiverId: myId },
        ],
      },
      order: [['createdAt', 'ASC']],
    });
    const filtered = messages.filter(m => {
      try { return !JSON.parse(m.deletedFor || '[]').includes(myId); } catch { return true; }
    });
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /messages
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const { content, receiverId, groupId, type, replyToId, replyToContent } = req.body;
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const msg = await Message.create({
      senderId: req.user.id,
      receiverId: receiverId || null,
      groupId: groupId || null,
      content: content || (mediaUrl ? (type === 'voice' ? 'Voice message' : 'Image') : ''),
      type: type || (mediaUrl ? (req.file?.mimetype?.includes('audio') ? 'voice' : 'image') : 'text'),
      mediaUrl,
      replyToId: replyToId || null,
      replyToContent: replyToContent || null,
    });
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// DELETE /messages/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { deleteFor } = req.body;
    const myId = req.user.id;
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });

    if (deleteFor === 'everyone') {
      if (msg.senderId !== myId) return res.status(403).json({ error: 'Not your message' });
      await msg.update({ deletedForEveryone: true, content: 'This message was deleted' });
      return res.json({ success: true, deletedForEveryone: true, id: msg.id });
    } else {
      const deletedFor = JSON.parse(msg.deletedFor || '[]');
      if (!deletedFor.includes(myId)) deletedFor.push(myId);
      await msg.update({ deletedFor: JSON.stringify(deletedFor) });
      return res.json({ success: true, deletedForMe: true, id: msg.id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// POST /messages/:id/react
router.post('/:id/react', auth, async (req, res) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const reactions = JSON.parse(msg.reactions || '{}');
    const { emoji } = req.body;
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(req.user.id);
    await msg.update({ reactions: JSON.stringify(reactions) });
    res.json(msg);
  } catch (err) { res.status(500).json({ error: 'React failed' }); }
});

// POST /messages/:id/pin
router.post('/:id/pin', auth, async (req, res) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    await msg.update({ isPinned: !msg.isPinned });
    res.json(msg);
  } catch (err) { res.status(500).json({ error: 'Pin failed' }); }
});

module.exports = router;
