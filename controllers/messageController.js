const { Message, User } = require('../models');
const { Op } = require('sequelize');

const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user.id;
    const messages = await Message.findAll({
      where: {
        deletedForEveryone: false,
        [Op.or]: [
          { senderId: myId, recipientId: userId },
          { senderId: userId, recipientId: myId },
        ]
      },
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'ASC']],
      limit: 100,
    });

    // Mark incoming messages as read — readBy stored as JSON array
    const unread = await Message.findAll({
      where: { senderId: userId, recipientId: myId, deletedForEveryone: false }
    });
    for (const msg of unread) {
      const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
      if (!readBy.includes(myId)) {
        await msg.update({ readBy: [...readBy, myId] });
      }
    }

    res.json(messages);
  } catch (err) {
    console.error('getConversation error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await Message.findAll({
      where: { groupId, deletedForEveryone: false },
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'ASC']],
      limit: 100,
    });
    res.json(messages);
  } catch (err) {
    console.error('getGroupMessages error:', err);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipientId, groupId, content, type, mediaUrl, replyToId } = req.body;
    if (!content && !mediaUrl) return res.status(400).json({ error: 'Message content required' });
    if (!recipientId && !groupId) return res.status(400).json({ error: 'recipientId or groupId required' });

    const message = await Message.create({
      senderId: req.user.id,
      recipientId: recipientId || null,
      groupId: groupId || null,
      content,
      type: type || 'text',
      mediaUrl: mediaUrl || null,
      replyToId: replyToId || null,
      readBy: [],
    });

    const full = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'avatar'] }]
    });

    // Emit via socket
    if (req.io) {
      const room = groupId
        ? `group:${groupId}`
        : `dm:${[req.user.id, recipientId].sort().join('-')}`;
      req.io.to(room).emit('new_message', full);
    }

    res.status(201).json(full);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

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
      req.io.to(room).emit('message_deleted', { id, forEveryone });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('deleteMessage error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji required' });

    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const reactions = { ...(message.reactions || {}) };
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1); // toggle off
    else reactions[emoji].push(req.user.id);        // toggle on

    await message.update({ reactions });
    res.json(message);
  } catch (err) {
    console.error('reactToMessage error:', err);
    res.status(500).json({ error: 'Failed to react' });
  }
};

module.exports = { getConversation, getGroupMessages, sendMessage, deleteMessage, reactToMessage };
