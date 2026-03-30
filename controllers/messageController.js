// controllers/messageController.js  — FIXED VERSION
const { Message, User } = require('../models');
const { Op } = require('sequelize');
const path = require('path');

// Helper: build public URL for uploaded files
const mediaUrl = (filename) => filename ? `/uploads/${path.basename(filename)}` : null;

// ── GET /messages/:userId  (1-on-1 conversation) ─────────────
exports.getConversation = async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: me, recipientId: other },
          { senderId: other, recipientId: me },
        ],
        // Don't return messages deleted for this user (isDeleted used for "delete for me")
      },
      order: [['createdAt', 'ASC']],
      raw: true,
    });

    // Normalise field: the frontend uses `receiverId` but DB has `recipientId`
    const normalised = messages.map(m => ({
      ...m,
      receiverId: m.recipientId,
    }));

    res.json(normalised);
  } catch (err) {
    console.error('getConversation error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
};

// ── GET /messages/group/:groupId ─────────────────────────────
exports.getGroupMessages = async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { groupId: req.params.groupId },
      order: [['createdAt', 'ASC']],
      raw: true,
    });
    res.json(messages);
  } catch (err) {
    console.error('getGroupMessages error:', err);
    res.status(500).json({ error: 'Failed to load group messages' });
  }
};

// ── POST /messages  (send message — text OR media) ────────────
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, groupId, content, type, replyToId, replyToContent } = req.body;

    // If multer put a file on req.file, use it
    const file = req.file;
    const msgType = type || (file ? (file.mimetype.startsWith('audio') ? 'voice' : 'image') : 'text');

    if (!receiverId && !groupId) {
      return res.status(400).json({ error: 'receiverId or groupId required' });
    }

    const message = await Message.create({
      senderId,
      recipientId: receiverId || null,
      groupId: groupId || null,
      content: content || (msgType === 'voice' ? 'Voice message' : msgType === 'image' ? 'Image' : ''),
      type: msgType,
      mediaUrl: file ? mediaUrl(file.filename) : null,
      replyToId: replyToId || null,
      reactions: {},
      readBy: [],
      deliveredTo: [],
    });

    // Return with receiverId alias so the frontend is happy
    res.status(201).json({ ...message.toJSON(), receiverId: message.recipientId });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// ── DELETE /messages/:id ─────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const { deleteFor } = req.body;

    if (deleteFor === 'everyone' && msg.senderId === req.user.id) {
      await msg.update({ deletedForEveryone: true, content: 'This message was deleted', mediaUrl: null });
    } else {
      // "Delete for me" — just destroy row (simplest approach)
      await msg.destroy();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('deleteMessage error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// ── POST /messages/:id/react ─────────────────────────────────
exports.reactToMessage = async (req, res) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });

    const { emoji } = req.body;
    const userId = req.user.id;

    let reactions = {};
    try { reactions = JSON.parse(msg.reactions || '{}'); } catch { reactions = {}; }

    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(userId);
    if (idx > -1) {
      reactions[emoji].splice(idx, 1); // toggle off
    } else {
      reactions[emoji].push(userId);
    }

    await msg.update({ reactions: JSON.stringify(reactions) });
    res.json({ reactions });
  } catch (err) {
    console.error('reactToMessage error:', err);
    res.status(500).json({ error: 'Failed to react' });
  }
};

// ── POST /messages/read  (mark messages as read) ─────────────
exports.markRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageIds } = req.body;
    if (!messageIds?.length) return res.json({ success: true });

    const msgs = await Message.findAll({ where: { id: messageIds } });
    for (const msg of msgs) {
      const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
      if (!readBy.includes(userId)) {
        await msg.update({ readBy: [...readBy, userId] });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
};
