const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { Status, User } = require('../models');
const { Op } = require('sequelize');

r.get('/', auth, async (req, res) => {
  try {
    const statuses = await Status.findAll({
      where: { expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User, attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

r.post('/', auth, async (req, res) => {
  try {
    const { content, type, backgroundColor, mediaUrl } = req.body;
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const status = await Status.create({
      userId: req.user.id, content, type, backgroundColor, mediaUrl, expiresAt: expires, views: [],
    });
    res.status(201).json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create status' });
  }
});

r.post('/:id/view', auth, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.userId === req.user.id) return res.json({ views: status.views || [] });
    const views = Array.isArray(status.views) ? status.views : [];
    if (!views.includes(req.user.id)) {
      views.push(req.user.id);
      await status.update({ views });
    }
    res.json({ views: views.length, viewerIds: views });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

r.delete('/:id', auth, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status || status.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await status.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = r;
