const { Message, User } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const path = require('path');

// ── GET CONVERSATION ─────────────────────────────────────────────────────────
const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user.id;
    const messages = await Message.findAll({
      where: {
        deletedForEveryone: false,
        [Op.or]: [
          { senderId: myId,   recipientId: userId },
          { senderId: userId, recipientId: myId   },
        ]
      },
      include: [{ model: User, as: 'sender', attributes: ['id','username','displayName','avatar'] }],
      order: [['createdAt','ASC']],
      limit: 200,
    });
    // Mark incoming as read
    const unread = await Message.findAll({
      where: { senderId: userId, recipientId: myId, deletedForEveryone: false }
    });
    for (const msg of unread) {
      const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
      if (!readBy.includes(myId)) await msg.update({ readBy: [...readBy, myId] });
    }
    res.json(messages);
  } catch (err) {
    console.error('getConversation error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// ── GET CONVERSATIONS LIST (chat list panel) ──────────────────────────────────
// Returns one entry per person you've chatted with, with last message preview
const getConversations = async (req, res) => {
  try {
    const myId = req.user.id;

    // Get all DMs involving this user (not deleted)
    const messages = await Message.findAll({
      where: {
        deletedForEveryone: false,
        groupId: null,
        [Op.or]: [
          { senderId: myId },
          { recipientId: myId },
        ],
      },
      include: [
        { model: User, as: 'sender',    attributes: ['id','username','displayName','avatar','isOnline','lastSeen'] },
      ],
      order: [['createdAt','DESC']],
    });

    // Build a map: otherId -> latest message
    const seen  = new Set();
    const convs = [];

    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.recipientId : msg.senderId;
      if (!otherId || seen.has(otherId)) continue;
      seen.add(otherId);

      // Fetch the other user's info
      const other = await User.findByPk(otherId, {
        attributes: ['id','username','displayName','avatar','isOnline','lastSeen'],
      });
      if (!other) continue;

      convs.push({
        id:              other.id,
        username:        other.username,
        displayName:     other.displayName,
        avatar:          other.avatar,
        isOnline:        other.isOnline,
        lastSeen:        other.lastSeen,
        lastMessage:     msg.deletedForEveryone
                           ? 'This message was deleted'
                           : msg.type === 'image' ? '📷 Image'
                           : msg.type === 'voice' ? '🎤 Voice note'
                           : msg.content,
        lastMessageTime: msg.createdAt,
        isMine:          msg.senderId === myId,
      });
    }

    res.json(convs);
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// ── GET GROUP MESSAGES ────────────────────────────────────────────────────────
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await Message.findAll({
      where: { groupId, deletedForEveryone: false },
      include: [{ model: User, as: 'sender', attributes: ['id','username','displayName','avatar'] }],
      order: [['createdAt','ASC']],
      limit: 100,
    });
    res.json(messages);
  } catch (err) {
    console.error('getGroupMessages error:', err);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
};

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { recipientId, groupId, content, type, replyToId } = req.body;

    // Handle media upload — file comes via multer as req.file
    let mediaUrl = req.body.mediaUrl || null;
    if (req.file) {
      // If using local storage — adjust this for Cloudinary when ready
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    // Validate — need content OR media
    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'Message content required' });
    }
    if (!recipientId && !groupId) {
      return res.status(400).json({ error: 'recipientId or groupId required' });
    }

    const message = await Message.create({
      senderId:    req.user.id,
      recipientId: recipientId || null,
      groupId:     groupId     || null,
      content:     content     || (type === 'voice' ? 'Voice note' : type === 'image' ? 'Image' : ''),
      type:        type        || 'text',
      mediaUrl,
      replyToId:   replyToId   || null,
      readBy:      [],
    });

    const full = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id','username','displayName','avatar'] }]
    });

    // Emit via socket — use 'newMessage' (camelCase, matches frontend)
    if (req.io) {
      const room = groupId
        ? `group:${groupId}`
        : `dm:${[req.user.id, recipientId].sort().join('-')}`;
      req.io.to(room).emit('newMessage', full);         // ← FIXED: was 'new_message'
      req.io.to(recipientId).emit('newMessage', full);  // also to personal room
    }

    res.status(201).json(full);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// ── DELETE MESSAGE ────────────────────────────────────────────────────────────
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { forEveryone } = req.body;
    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (forEveryone) {
      await message.update({ deletedForEveryone: true, content: 'This message was deleted', mediaUrl: null });
    } else {
      await message.update({ isDeleted: true });
    }
    if (req.io) {
      const room = message.groupId
        ? `group:${message.groupId}`
        : `dm:${[message.senderId, message.recipientId].sort().join('-')}`;
      req.io.to(room).emit('messageDeleted', { id, deletedForEveryone: !!forEveryone }); // ← FIXED case
      req.io.to(message.recipientId).emit('messageDeleted', { id, deletedForEveryone: !!forEveryone });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('deleteMessage error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// ── REACT TO MESSAGE ──────────────────────────────────────────────────────────
const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji required' });
    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: 'Not found' });
    const reactions = { ...(message.reactions || {}) };
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(req.user.id);
    await message.update({ reactions });
    res.json(message);
  } catch (err) {
    console.error('reactToMessage error:', err);
    res.status(500).json({ error: 'Failed to react' });
  }
};

module.exports = {
  getConversation,
  getConversations,
  getGroupMessages,
  sendMessage,
  deleteMessage,
  reactToMessage,
};
