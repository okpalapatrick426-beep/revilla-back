// controllers/messageController.js
// ─── ADD these two functions / patch sendMessage in your existing controller ───
//
// 1. Replace your existing sendMessage with this version (handles req.file from multer)
// 2. Add markRead at the bottom
// 3. Add getConversations if it doesn't exist
//
// Keep all your other functions (deleteMessage, reactToMessage, etc.) unchanged.

const path = require('path');
const { Message, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// ─── GET /messages/conversations ──────────────────────────────────────────────
exports.getConversations = async (req, res) => {
  try {
    // Get latest message per unique partner
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id },
          { recipientId: req.user.id },
        ],
        isDeleted: false,
      },
      order: [['createdAt', 'DESC']],
    });

    // Build a map: partnerId -> latest message
    const seen = new Map();
    for (const msg of messages) {
      const partnerId = msg.senderId === req.user.id ? msg.recipientId : msg.senderId;
      if (!partnerId) continue;
      if (!seen.has(partnerId)) seen.set(partnerId, msg);
    }

    const partnerIds = Array.from(seen.keys());
    if (partnerIds.length === 0) return res.json([]);

    const users = await User.findAll({
      where: { id: partnerIds },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
    });

    const result = users.map(u => {
      const latest = seen.get(u.id);
      const unreadCount = messages.filter(
        m => m.senderId === u.id && m.recipientId === req.user.id &&
          !(Array.isArray(m.readBy) ? m.readBy : []).includes(req.user.id)
      ).length;
      return {
        ...u.toJSON(),
        lastMessage: latest?.type !== 'text' ? `📎 ${latest?.type}` : latest?.content,
        lastMessageTime: latest?.createdAt,
        unreadCount,
      };
    }).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(result);
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
};

// ─── GET /messages/:userId ─────────────────────────────────────────────────────
exports.getConversation = async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id, recipientId: req.params.userId },
          { senderId: req.params.userId, recipientId: req.user.id },
        ],
        isDeleted: false,
      },
      order: [['createdAt', 'ASC']],
    });
    res.json(messages);
  } catch (err) {
    console.error('getConversation error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
};

// ─── POST /messages ────────────────────────────────────────────────────────────
// This version handles both JSON (text) and multipart/form-data (media)
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, type, replyToId, replyToContent, groupId } = req.body;

    let mediaUrl = null;

    // If multer attached a file, build the URL path
    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    const msg = await Message.create({
      senderId: req.user.id,
      recipientId: receiverId || null,
      groupId: groupId || null,
      content: content || '',
      type: type || 'text',
      mediaUrl,
      replyToId: replyToId || null,
      readBy: [],
      deliveredTo: [],
    });

    // If replyToContent was provided, attach it for the client
    const result = msg.toJSON();
    if (replyToContent) result.replyToContent = replyToContent;

    res.status(201).json(result);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// ─── POST /messages/mark-read ──────────────────────────────────────────────────
exports.markRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds required' });
    }

    const messages = await Message.findAll({ where: { id: messageIds } });
    for (const msg of messages) {
      const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
      if (!readBy.includes(req.user.id)) {
        readBy.push(req.user.id);
        await msg.update({ readBy });
      }
    }

    res.json({ success: true, count: messages.length });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
};

// ─── DELETE /messages/:id ──────────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const { deleteFor } = req.body;
    if (deleteFor === 'everyone' && msg.senderId === req.user.id) {
      await msg.update({ deletedForEveryone: true, content: 'This message was deleted', mediaUrl: null });
    } else {
      await msg.update({ isDeleted: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// ─── POST /messages/:id/react ──────────────────────────────────────────────────
exports.reactToMessage = async (req, res) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const { emoji } = req.body;
    const reactions = typeof msg.reactions === 'string'
      ? JSON.parse(msg.reactions)
      : (msg.reactions || {});
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(req.user.id);
    await msg.update({ reactions });
    res.json({ success: true, reactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to react' });
  }
};

// ─── GET /messages/group/:groupId ─────────────────────────────────────────────
exports.getGroupMessages = async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { groupId: req.params.groupId, isDeleted: false },
      order: [['createdAt', 'ASC']],
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load group messages' });
  }
};
