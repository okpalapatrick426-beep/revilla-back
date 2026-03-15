const { Message, User } = require('../models');
const { Op } = require('sequelize');
const path = require('path');

const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user.id;
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

    // Filter out messages deleted for this user
    const filtered = messages.filter(m => {
      const deletedFor = JSON.parse(m.deletedFor || '[]');
      return !deletedFor.includes(myId);
    });

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { content, receiverId, groupId, type, replyToId, replyToContent } = req.body;
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const msg = await Message.create({
      senderId: req.user.id,
      receiverId: receiverId || null,
      groupId: groupId || null,
      content: content || (mediaUrl ? 'Image' : ''),
      type: type || (mediaUrl ? 'image' : 'text'),
      mediaUrl,
      replyToId: replyToId || null,
      replyToContent: replyToContent || null,
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteFor } = req.body; // 'me' or 'everyone'
    const myId = req.user.id;

    const msg = await Message.findByPk(id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (deleteFor === 'everyone') {
      if (msg.senderId !== myId) {
        return res.status(403).json({ error: 'You can only delete your own messages for everyone' });
      }
      await msg.update({ deletedForEveryone: true, content: 'This message was deleted' });
      return res.json({ success: true, deletedForEveryone: true, id });
    } else {
      // Delete for me only
      const deletedFor = JSON.parse(msg.deletedFor || '[]');
      if (!deletedFor.includes(myId)) {
        deletedFor.push(myId);
      }
      await msg.update({ deletedFor: JSON.stringify(deletedFor) });
      return res.json({ success: true, deletedForMe: true, id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const msg = await Message.findByPk(id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const reactions = JSON.parse(msg.reactions || '{}');
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1); // toggle off
    else reactions[emoji].push(req.user.id);

    await msg.update({ reactions: JSON.stringify(reactions) });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'React failed' });
  }
};

const pinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await Message.findByPk(id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    await msg.update({ isPinned: !msg.isPinned });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Pin failed' });
  }
};

module.exports = { getMessages, sendMessage, deleteMessage, reactToMessage, pinMessage };
