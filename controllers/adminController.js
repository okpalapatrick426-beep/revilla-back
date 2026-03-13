const { User, Message, Group, Referral, sequelize } = require('../models');
const { Op } = require('sequelize');

// Stats overview
const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, onlineUsers, totalMessages, totalGroups, reportedMessages] = await Promise.all([
      User.count(),
      User.count({ where: { isOnline: true } }),
      Message.count({ where: { deletedForEveryone: false } }),
      Group.count(),
      Message.count({ where: { type: 'system' } }), // placeholder for reports
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.count({ where: { createdAt: { [Op.gte]: today } } });
    const messagesToday = await Message.count({ where: { createdAt: { [Op.gte]: today } } });

    res.json({ totalUsers, onlineUsers, totalMessages, totalGroups, newUsersToday, messagesToday, reportedMessages });
  } catch (err) {
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
      limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ users, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Ban/unban user
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
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

const unbanUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isBanned: false, banReason: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'moderator', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
};

// Get users who opted in to location sharing (admin transparency tool)
const getLocationOptIns = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { locationSharingEnabled: true },
      attributes: ['id', 'username', 'displayName', 'avatar', 'locationLat', 'locationLng', 'locationUpdatedAt'],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
};

// Get group messages for moderation (moderator tool — disclosed in ToS)
const getGroupMessagesForModeration = async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await Message.findAll({
      where: { groupId },
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Delete message as admin
const adminDeleteMessage = async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Not found' });
    await message.update({ deletedForEveryone: true, content: '[Removed by moderator]', mediaUrl: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

const getReferralStats = async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
};

module.exports = {
  getDashboardStats, getAllUsers, banUser, unbanUser, updateUserRole,
  getLocationOptIns, getGroupMessagesForModeration, adminDeleteMessage, getReferralStats,
};
