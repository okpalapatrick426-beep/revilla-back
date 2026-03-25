const { Message, User } = require('../models');
const { Op } = require('sequelize');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

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
      include: [{
        model: User, as: 'sender',
        attributes: ['id', 'username', 'displayName', 'avatar']
      }],
      order: [['createdAt', 'ASC']],
      limit: 100,
    });

    // Mark messages from the other person as read
    // readBy is stored as a JSON array of user IDs
    const unreadMessages = await Message.findAll({
      where: {
        senderId: userId,
        recipientId: myId,
        deletedForEveryone: false,
      }
    });

    for (const msg of unreadMessages) {
      let readByArray = [];
      try {
        readByArray = Array.isArray(msg.readBy)
          ? msg.readBy
          : JSON.parse(msg.readBy || '[]');
      } catch { readByArray = []; }

      if (!readByArray.includes(myId)) {
        readByArray.push(myId);
        await msg.update({ readBy: JSON.stringify(readByArray) });
      }
    }

    // Notify the sender via socket that their messages were read
    if (req.io && unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(m => m.id);
      // Emit to the sender's personal room
      req.io.to(String(userId)).emit('messagesRead', {
        messageIds,
        readBy: myId,
        conversationWith: myId,
      });
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
      include: [{
        model: User, as: 'sender',
        attributes: ['id', 'username', 'displayName', 'avatar']
      }],
      order: [['createdAt', 'ASC']],
      limit: 100,
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipientId, groupId, content, type, replyToId, replyToContent } = req.body;

    // Allow message if: has text content OR has uploaded file
    if (!content && !req.file) {
      return res.status(400).json({ error: 'Message content required' });
    }

    let mediaUrl = null;
    let messageType = type || 'text';

    // Upload media to Cloudinary if file was attached
    if (req.file) {
      const isVoice = req.file.mimetype.includes('audio') || type === 'voice';
      const isVideo = req.file.mimetype.includes('video');
      const isImage = req.file.mimetype.includes('image');

      const folder = isVoice ? 'revilla/voice'
        : isVideo ? 'revilla/videos'
        : 'revilla/images';

      const resourceType = isVoice ? 'video' : (isVideo ? 'video' : 'image'); // Cloudinary uses 'video' for audio too

      try {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder,
          resource_type: resourceType,
        });
        mediaUrl = result.secure_url;
        messageType = isVoice ? 'voice' : isVideo ? 'video' : 'image';
      } catch (uploadErr) {
        console.error('Cloudinary upload failed:', uploadErr);
        // If Cloudinary fails, still send the message as text
        mediaUrl = null;
      }
    }

    const message = await Message.create({
      senderId: req.user.id,
      recipientId: recipientId || null,
      groupId: groupId || null,
      content: content || (messageType === 'voice' ? 'Voice message' : messageType === 'image' ? 'Image' : ''),
      type: messageType,
      mediaUrl,
      replyToId: replyToId || null,
      replyToContent: replyToContent || null,
      readBy: JSON.stringify([]), // Start with empty read array
    });

    const full = await Message.findByPk(message.id, {
      include: [{
        model: User, as: 'sender',
        attributes: ['id', 'username', 'displayName', 'avatar']
      }]
    });

    // Emit to the correct socket room
    if (req.io) {
      const room = groupId
        ? `group:${groupId}`
        : `dm:${[req.user.id, recipientId].sort().join('-')}`;

      // Use consistent event name: 'newMessage' (camelCase)
      req.io.to(room).emit('newMessage', full);

      // Also emit to recipient's personal room (so they get it even if not in the DM room)
      if (recipientId) {
        req.io.to(String(recipientId)).emit('newMessage', full);
      }
    }

    res.status(201).json(full);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

const markMessagesRead = async (req, res) => {
  try {
    const { senderId } = req.params;
    const myId = req.user.id;

    const unread = await Message.findAll({
      where: {
        senderId,
        recipientId: myId,
        deletedForEveryone: false,
      }
    });

    const updatedIds = [];
    for (const msg of unread) {
      let readByArray = [];
      try {
        readByArray = Array.isArray(msg.readBy)
          ? msg.readBy
          : JSON.parse(msg.readBy || '[]');
      } catch { readByArray = []; }

      if (!readByArray.includes(myId)) {
        readByArray.push(myId);
        await msg.update({ readBy: JSON.stringify(readByArray) });
        updatedIds.push(msg.id);
      }
    }

    // Notify sender via socket
    if (req.io && updatedIds.length > 0) {
      req.io.to(String(senderId)).emit('messagesRead', {
        messageIds: updatedIds,
        readBy: myId,
        conversationWith: myId,
      });
    }

    res.json({ success: true, updated: updatedIds.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

const getConversations = async (req, res) => {
  try {
    const myId = req.user.id;

    // Get all messages where I'm sender or recipient
    const messages = await Message.findAll({
      where: {
        deletedForEveryone: false,
        [Op.or]: [
          { senderId: myId },
          { recipientId: myId }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Deduplicate: one entry per unique conversation partner
    const seen = new Set();
    const conversations = [];

    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.recipientId : msg.senderId;
      if (!otherId || seen.has(otherId)) continue;
      seen.add(otherId);

      // Get the other user's info
      const otherUser = await User.findByPk(otherId, {
        attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen']
      });

      if (!otherUser) continue;

      // Count unread messages (messages from other person that don't have myId in readBy)
      const allMsgs = await Message.findAll({
        where: {
          senderId: otherId,
          recipientId: myId,
          deletedForEveryone: false,
        }
      });

      let unreadCount = 0;
      for (const m of allMsgs) {
        let rb = [];
        try { rb = JSON.parse(m.readBy || '[]'); } catch { rb = []; }
        if (!rb.includes(myId)) unreadCount++;
      }

      conversations.push({
        id: otherUser.id,
        username: otherUser.username,
        displayName: otherUser.displayName,
        avatar: otherUser.avatar,
        isOnline: otherUser.isOnline,
        lastSeen: otherUser.lastSeen,
        lastMessage: msg.content,
        lastMessageType: msg.type,
        lastMessageTime: msg.createdAt,
        unreadCount,
      });
    }

    res.json(conversations);
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
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
      await message.update({
        deletedForEveryone: true,
        content: 'This message was deleted',
        mediaUrl: null
      });
    } else {
      await message.update({ isDeleted: true });
    }
    if (req.io) {
      const room = message.groupId
        ? `group:${message.groupId}`
        : `dm:${[message.senderId, message.recipientId].sort().join('-')}`;
      req.io.to(room).emit('messageDeleted', { id, forEveryone });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: 'Not found' });
    let reactions = {};
    try { reactions = JSON.parse(message.reactions || '{}'); } catch { reactions = {}; }
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(req.user.id);
    await message.update({ reactions: JSON.stringify(reactions) });
    // Emit reaction update via socket
    if (req.io) {
      const room = message.groupId
        ? `group:${message.groupId}`
        : `dm:${[message.senderId, message.recipientId].sort().join('-')}`;
      req.io.to(room).emit('messageReacted', { id, reactions });
    }
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: 'Failed to react' });
  }
};

module.exports = {
  getConversation,
  getGroupMessages,
  sendMessage,
  markMessagesRead,
  getConversations,
  deleteMessage,
  reactToMessage
};
