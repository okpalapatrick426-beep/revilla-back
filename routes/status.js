// routes/status.js
const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { User } = require('../models');
const { Op } = require('sequelize');

// Safely load Status model — server won't crash if not defined yet
let Status;
try { Status = require('../models').Status; } catch (e) { Status = null; }

const requireStatus = (req, res, next) => {
  if (!Status) return res.status(503).json({ error: 'Stories/Status not available yet' });
  next();
};

// Get all active statuses (not expired)
r.get('/', auth, requireStatus, async (req, res) => {
  try {
    const statuses = await Status.findAll({
      where: { expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User, attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(statuses);
  } catch (err) {
    console.error('GET /status error:', err);
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// Post a new status
r.post('/', auth, requireStatus, async (req, res) => {
  try {
    const { content, type, backgroundColor, mediaUrl } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const status = await Status.create({
      userId: req.user.id, content, type, backgroundColor,
      mediaUrl, expiresAt, views: [],
    });
    res.status(201).json(status);
  } catch (err) {
    console.error('POST /status error:', err);
    res.status(500).json({ error: 'Failed to create status' });
  }
});

// Record a view
r.post('/:id/view', auth, requireStatus, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Status not found' });
    // Owner viewing their own — just return current views
    if (status.userId === req.user.id) return res.json({ views: status.views || [] });
    const views = Array.isArray(status.views) ? status.views : [];
    if (!views.includes(req.user.id)) {
      views.push(req.user.id);
      await status.update({ views });
    }
    res.json({ views: views.length, viewerIds: views });
  } catch (err) {
    console.error('POST /status/:id/view error:', err);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Delete a status
r.delete('/:id', auth, requireStatus, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Status not found' });
    if (status.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await status.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /status error:', err);
    res.status(500).json({ error: 'Failed to delete status' });
  }
});

module.exports = r;
