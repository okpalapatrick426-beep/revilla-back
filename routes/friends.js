// routes/friends.js
const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { Friend, User } = require('../models');
const { Op } = require('sequelize');

// GET /friends — all accepted friends
r.get('/', auth, async (req, res) => {
  try {
    const friends = await Friend.findAll({
      where: {
        [Op.or]: [{ requesterId: req.user.id }, { receiverId: req.user.id }],
        status: 'accepted',
      },
      include: [
        { model: User, as: 'Requester', attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'] },
        { model: User, as: 'Receiver', attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'] },
      ],
    });
    res.json(friends);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

// GET /friends/requests — incoming pending requests
r.get('/requests', auth, async (req, res) => {
  try {
    const requests = await Friend.findAll({
      where: { receiverId: req.user.id, status: 'pending' },
      include: [
        { model: User, as: 'Requester', attributes: ['id', 'username', 'displayName', 'avatar'] },
      ],
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// GET /friends/sent — outgoing pending requests
r.get('/sent', auth, async (req, res) => {
  try {
    const sent = await Friend.findAll({
      where: { requesterId: req.user.id, status: 'pending' },
      include: [
        { model: User, as: 'Receiver', attributes: ['id', 'username', 'displayName', 'avatar'] },
      ],
    });
    res.json(sent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sent requests' });
  }
});

// POST /friends/request — send a friend request (body: { receiverId })
r.post('/request', auth, async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ error: 'receiverId required' });
    if (receiverId === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });

    const existing = await Friend.findOne({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, receiverId },
          { requesterId: receiverId, receiverId: req.user.id },
        ],
      },
    });
    if (existing) return res.status(400).json({ error: 'Request already exists', status: existing.status });

    const friend = await Friend.create({ requesterId: req.user.id, receiverId, status: 'pending' });

    // Emit socket notification to receiver
    const io = req.app.get('io');
    if (io) io.to(receiverId).emit('friendRequest', { from: req.user.id, friendId: friend.id });

    res.status(201).json({ success: true, friend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// POST /friends/accept — accept a friend request (body: { requesterId })
r.post('/accept', auth, async (req, res) => {
  try {
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: 'requesterId required' });

    const request = await Friend.findOne({
      where: { requesterId, receiverId: req.user.id, status: 'pending' },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    await request.update({ status: 'accepted' });

    // Emit socket notification to original requester
    const io = req.app.get('io');
    if (io) io.to(requesterId).emit('friendAccepted', { from: req.user.id });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// POST /friends/reject — reject / cancel a request (body: { userId })
r.post('/reject', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    await Friend.destroy({
      where: {
        [Op.or]: [
          { requesterId: userId, receiverId: req.user.id, status: 'pending' },
          { requesterId: req.user.id, receiverId: userId, status: 'pending' },
        ],
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// DELETE /friends/:userId — remove an accepted friend
r.delete('/:userId', auth, async (req, res) => {
  try {
    await Friend.destroy({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, receiverId: req.params.userId },
          { requesterId: req.params.userId, receiverId: req.user.id },
        ],
        status: 'accepted',
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

module.exports = r;
