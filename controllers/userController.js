const { User, Friend } = require('../models');
const { Op } = require('sequelize');

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'locationLat', 'locationLng'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const allowed = ['displayName', 'bio', 'avatar', 'showOnlineStatus', 'readReceipts', 'notificationsEnabled'];
    const updates = {};
    allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });
    await req.user.update(updates);
    const safe = req.user.toJSON();
    delete safe.password;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const updateLocationSharing = async (req, res) => {
  try {
    const { enabled, lat, lng } = req.body;
    if (enabled && (lat === undefined || lng === undefined)) {
      return res.status(400).json({ error: 'Location coordinates required when enabling location sharing' });
    }
    const updates = { locationSharingEnabled: !!enabled };
    if (enabled) {
      updates.locationLat = lat;
      updates.locationLng = lng;
      updates.locationUpdatedAt = new Date();
    } else {
      updates.locationLat = null;
      updates.locationLng = null;
      updates.locationUpdatedAt = null;
    }
    await req.user.update(updates);
    res.json({
      success: true,
      locationSharingEnabled: !!enabled,
      message: enabled ? 'Location sharing enabled' : 'Location sharing disabled and data cleared'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location settings' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { displayName: { [Op.like]: `%${q}%` } },
        ],
        id: { [Op.ne]: req.user.id },
        isBanned: false,
      },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
      limit: 20,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { id: { [Op.ne]: req.user.id }, isBanned: false },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
      order: [['isOnline', 'DESC'], ['displayName', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

module.exports = { getProfile, updateProfile, updateLocationSharing, searchUsers, getAllUsers };
