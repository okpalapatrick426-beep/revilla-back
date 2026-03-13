const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { Status, User } = require('../models');

r.get('/', auth, async (req, res) => {
  const statuses = await Status.findAll({
    where: { expiresAt: { [require('sequelize').Op.gt]: new Date() } },
    include: [{ model: User, attributes: ['id', 'username', 'displayName', 'avatar'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(statuses);
});

r.post('/', auth, async (req, res) => {
  const { content, type, backgroundColor, mediaUrl } = req.body;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const status = await Status.create({
    userId: req.user.id, content, type, backgroundColor, mediaUrl, expiresAt: expires,
  });
  res.status(201).json(status);
});

r.post('/:id/view', auth, async (req, res) => {
  const status = await Status.findByPk(req.params.id);
  if (!status) return res.status(404).json({ error: 'Not found' });
  const views = status.views || [];
  if (!views.includes(req.user.id)) {
    views.push(req.user.id);
    await status.update({ views });
  }
  res.json({ views: views.length });
});

r.delete('/:id', auth, async (req, res) => {
  const status = await Status.findByPk(req.params.id);
  if (!status || status.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  await status.destroy();
  res.json({ success: true });
});

module.exports = r;
