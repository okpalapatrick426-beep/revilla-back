const { User, Message, sequelize } = require('../models');
const { Op } = require('sequelize');

// Safely try to load optional models (Group, Referral may not exist yet)
let Group, Referral;
try { Group = require('../models').Group; } catch (e) { Group = null; }
try { Referral = require('../models').Referral; } catch (e) { Referral = null; }

// Stats overview
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, onlineUsers, totalMessages, newUsersToday, messagesToday] = await Promise.all([
      User.count(),
      User.count({ where: { isOnline: true } }),
      Message.count({ where: { deletedForEveryone: false } }),
      User.count({ where: { createdAt: { [Op.gte]: today } } }),
      Message.count({ where: { createdAt: { [Op.gte]: today } } }),
    ]);

    const totalGroups = Group ? await Group.count() : 0;
    const reportedMessages = 0; // placeholder

    res.json({ totalUsers, onlineUsers, totalMessages, totalGroups, newUsersToday, messagesToday, reportedMessages });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Get all users (admin view)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { displayName: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) where.role = role;

    const { rows: users, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ users, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Ban user
const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot ban admin' });
    await user.update({ isBanned: true, banReason: reason || 'Violation of terms of service' });
    res.json({ success: true, message: `User ${user.username} banned` });
  } catch (err) {
    console.error('banUser error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

// Unban user
const unbanUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isBanned: false, banReason: null });
    res.json({ success: true });
  } catch (err) {
    console.error('unbanUser error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'moderator', 'admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ role });
    res.json({ success: true });
  } catch (err) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

// Location opt-ins (admin transparency tool)
const getLocationOptIns = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { locationSharingEnabled: true },
      attributes: ['id', 'username', 'displayName', 'avatar', 'locationLat', 'locationLng', 'locationUpdatedAt'],
    });
    res.json(users);
  } catch (err) {
    console.error('getLocationOptIns error:', err);
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
};

// Get group messages for moderation
const getGroupMessagesForModeration = async (req, res) => {
  try {
    if (!Group) return res.status(503).json({ error: 'Groups not available yet' });
    const { groupId } = req.params;
    const messages = await Message.findAll({
      where: { groupId },
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(messages);
  } catch (err) {
    console.error('getGroupMessagesForModeration error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Admin delete message
const adminDeleteMessage = async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Not found' });
    await message.update({ deletedForEveryone: true, content: '[Removed by moderator]', mediaUrl: null });
    res.json({ success: true });
  } catch (err) {
    console.error('adminDeleteMessage error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// Referral stats
const getReferralStats = async (req, res) => {
  try {
    if (!Referral) return res.status(503).json({ error: 'Referral system not available yet' });
    const stats = await Referral.findAll({
      include: [
        { model: User, as: 'referrer', attributes: ['id', 'username', 'displayName'] },
        { model: User, as: 'referred', attributes: ['id', 'username', 'displayName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.json(stats);
  } catch (err) {
    console.error('getReferralStats error:', err);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
};

module.exports = {
  getDashboardStats, getAllUsers, banUser, unbanUser, updateUserRole,
  getLocationOptIns, getGroupMessagesForModeration, adminDeleteMessage, getReferralStats,
};
