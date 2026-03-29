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
      include: [{ model: User, as: 'sender', attributes: ['id','username','displayName','avatar'] }],
      order: [['createdAt','ASC']],
      limit: 200,
    });

    // Mark all incoming messages as read + emit socket event for real-time tick update
    const unread = messages.filter(m => m.senderId === userId && m.recipientId === myId);
    if (unread.length > 0) {
      const unreadIds = unread.map(m => m.id);
      for (const msg of unread) {
        const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
        if (!readBy.includes(myId)) {
          await msg.update({ readBy: [...readBy, myId] });
        }
      }
      // Tell the SENDER their messages were read (real-time blue ticks)
      if (req.io) {
        req.io.to(userId).emit('messagesRead', {
          messageIds: unreadIds,
          readBy: myId,
          conversationId: myId,
        });
      }
    }

    res.json(messages);
  } catch (err) {
    console.error('getConversation:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

const getConversations = async (req, res) => {
  try {
    const myId = req.user.id;
    const messages = await Message.findAll({
      where: {
        deletedForEveryone: false,
        groupId: null,
        [Op.or]: [{ senderId: myId }, { recipientId: myId }],
      },
      include: [{ model: User, as: 'sender', attributes: ['id','username','displayName','avatar','isOnline','lastSeen'] }],
      order: [['createdAt','DESC']],
    });

    const seen = new Set();
    const convs = [];
    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.recipientId : msg.senderId;
      if (!otherId || seen.has(otherId)) continue;
      seen.add(otherId);
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
        lastMessage:     msg.deletedForEveryone ? 'This message was deleted'
                         : msg.type==='image' ? '📷 Image'
                         : msg.type==='voice' ? '🎤 Voice note'
                         : msg.content,
        lastMessageTime: msg.createdAt,
        isMine:          msg.senderId === myId,
      });
    }
    res.json(convs);
  } catch (err) {
    console.error('getConversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

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
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipientId, groupId, content, type, replyToId } = req.body;

    let mediaUrl = req.body.mediaUrl || null;
    if (req.file) mediaUrl = `/uploads/${req.file.filename}`;

    if (!content && !mediaUrl) return res.status(400).json({ error: 'Content required' });
    if (!recipientId && !groupId) return res.status(400).json({ error: 'Recipient required' });

    const message = await Message.create({
      senderId:    req.user.id,
      recipientId: recipientId || null,
      groupId:     groupId     || null,
      content:     content     || (type==='voice' ? 'Voice note' : 'Image'),
      type:        type        || 'text',
      mediaUrl,
      replyToId:   replyToId   || null,
      readBy:      [],
    });

    const full = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id','username','displayName','avatar'] }]
    });

    if (req.io) {
      const room = groupId
        ? `group:${groupId}`
        : `dm:${[req.user.id, recipientId].sort().join('-')}`;
      req.io.to(room).emit('newMessage', full);
      req.io.to(recipientId).emit('newMessage', full);
    }

    res.status(201).json(full);
  } catch (err) {
    console.error('sendMessage:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { forEveryone } = req.body;
    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: 'Not found' });
    if (message.senderId !== req.user.id && req.user.role === 'user')
      return res.status(403).json({ error: 'Not authorized' });
    if (forEveryone)
      await message.update({ deletedForEveryone: true, content: 'This message was deleted', mediaUrl: null });
    else
      await message.update({ isDeleted: true });
    if (req.io) {
      const room = message.groupId
        ? `group:${message.groupId}`
        : `dm:${[message.senderId, message.recipientId].sort().join('-')}`;
      req.io.to(room).emit('messageDeleted', { id, deletedForEveryone: !!forEveryone });
      req.io.to(message.recipientId).emit('messageDeleted', { id, deletedForEveryone: !!forEveryone });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
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
    res.status(500).json({ error: 'Failed to react' });
  }
};

module.exports = { getConversation, getConversations, getGroupMessages, sendMessage, deleteMessage, reactToMessage };
