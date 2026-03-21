// routes/friends.js
const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { User } = require('../models');
const { Op } = require('sequelize');

// Safely load Friend model — server won't crash if not defined yet
let Friend;
try { Friend = require('../models').Friend; } catch (e) { Friend = null; }

const requireFriend = (req, res, next) => {
  if (!Friend) return res.status(503).json({ error: 'Friends feature not available yet' });
  next();
};

// Get accepted friends
r.get('/', auth, requireFriend, async (req, res) => {
  try {
    const friends = await Friend.findAll({
      where: {
        [Op.or]: [{ userId: req.user.id }, { friendId: req.user.id }],
        status: 'accepted',
      },
    });
    const ids = friends.map(f => f.userId === req.user.id ? f.friendId : f.userId);
    const users = await User.findAll({
      where: { id: ids },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
    });
    res.json(users);
  } catch (err) {
    console.error('GET /friends error:', err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get pending friend requests
r.get('/requests', auth, requireFriend, async (req, res) => {
  try {
    const requests = await Friend.findAll({
      where: { friendId: req.user.id, status: 'pending' },
    });
    const ids = requests.map(req => req.userId);
    const users = await User.findAll({
      where: { id: ids },
      attributes: ['id', 'username', 'displayName', 'avatar'],
    });
    res.json(users);
  } catch (err) {
    console.error('GET /friends/requests error:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Send friend request
r.post('/request/:userId', auth, requireFriend, async (req, res) => {
  try {
    const existing = await Friend.findOne({
      where: { userId: req.user.id, friendId: req.params.userId },
    });
    if (existing) return res.status(400).json({ error: 'Request already sent' });
    await Friend.create({ userId: req.user.id, friendId: req.params.userId });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /friends/request error:', err);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// Accept friend request
r.put('/accept/:userId', auth, requireFriend, async (req, res) => {
  try {
    const request = await Friend.findOne({
      where: { userId: req.params.userId, friendId: req.user.id, status: 'pending' },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    await request.update({ status: 'accepted' });
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /friends/accept error:', err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Remove friend
r.delete('/:userId', auth, requireFriend, async (req, res) => {
  try {
    await Friend.destroy({
      where: {
        [Op.or]: [
          { userId: req.user.id, friendId: req.params.userId },
          { userId: req.params.userId, friendId: req.user.id },
        ],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /friends error:', err);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

module.exports = r;
