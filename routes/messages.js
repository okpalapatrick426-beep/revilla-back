const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { Status, User } = require('../models');
const { Op } = require('sequelize');

router.get('/', auth, async (req, res) => {
  try {
    const statuses = await Status.findAll({
      where: { expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User, as: 'User', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

router.get('/mine', auth, async (req, res) => {
  try {
    const statuses = await Status.findAll({
      where: { userId: req.user.id, expiresAt: { [Op.gt]: new Date() } },
      order: [['createdAt', 'DESC']],
    });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your statuses' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { content, type, backgroundColor, mediaUrl } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const status = await Status.create({
      userId: req.user.id,
      content: content || '',
      type: type || 'text',
      backgroundColor: backgroundColor || '#1a1a2e',
      mediaUrl: mediaUrl || null,
      expiresAt,
      viewers: '[]',
      viewCount: 0,
    });
    res.status(201).json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create status' });
  }
});

router.post('/:id/view', auth, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    const viewers = JSON.parse(status.viewers || '[]');
    if (!viewers.includes(req.user.id)) {
      viewers.push(req.user.id);
      await status.update({ viewers: JSON.stringify(viewers), viewCount: viewers.length });
    }
    res.json({ success: true, viewCount: viewers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark view' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.userId !== req.user.id) return res.status(403).json({ error: 'Not yours' });
    await status.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;