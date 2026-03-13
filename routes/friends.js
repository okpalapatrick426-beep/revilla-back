const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { Friend, User } = require('../models');
const { Op } = require('sequelize');

r.get('/', auth, async (req, res) => {
  const friends = await Friend.findAll({
    where: { [Op.or]: [{ userId: req.user.id }, { friendId: req.user.id }], status: 'accepted' },
  });
  const ids = friends.map(f => f.userId === req.user.id ? f.friendId : f.userId);
  const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'] });
  res.json(users);
});

r.get('/requests', auth, async (req, res) => {
  const requests = await Friend.findAll({
    where: { friendId: req.user.id, status: 'pending' },
  });
  const ids = requests.map(r => r.userId);
  const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'username', 'displayName', 'avatar'] });
  res.json(users);
});

r.post('/request/:userId', auth, async (req, res) => {
  const existing = await Friend.findOne({ where: { userId: req.user.id, friendId: req.params.userId } });
  if (existing) return res.status(400).json({ error: 'Request already sent' });
  await Friend.create({ userId: req.user.id, friendId: req.params.userId });
  res.json({ success: true });
});

r.put('/accept/:userId', auth, async (req, res) => {
  const request = await Friend.findOne({ where: { userId: req.params.userId, friendId: req.user.id, status: 'pending' } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  await request.update({ status: 'accepted' });
  res.json({ success: true });
});

r.delete('/:userId', auth, async (req, res) => {
  await Friend.destroy({
    where: {
      [Op.or]: [
        { userId: req.user.id, friendId: req.params.userId },
        { userId: req.params.userId, friendId: req.user.id },
      ]
    }
  });
  res.json({ success: true });
});

module.exports = r;
