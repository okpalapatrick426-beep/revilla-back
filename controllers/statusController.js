// controllers/statusController.js  — COMPLETE VERSION
const { Status, User, Friendship } = require('../models');
const { Op } = require('sequelize');
const path = require('path');

const mediaUrl = (f) => f ? `/uploads/${path.basename(f)}` : null;

// ── GET /status  — statuses from friends + self, last 24 h ───
exports.getStatuses = async (req, res) => {
  try {
    const me = req.user.id;

    // Get friend IDs
    const friendships = await Friendship.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [{ requesterId: me }, { receiverId: me }],
      },
      attributes: ['requesterId', 'receiverId'],
    });
    const friendIds = friendships.map(f => f.requesterId === me ? f.receiverId : f.requesterId);

    const statuses = await Status.findAll({
      where: {
        userId: [me, ...friendIds],
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [{ model: User, as: 'Author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json(statuses);
  } catch (err) {
    console.error('getStatuses error:', err);
    res.status(500).json({ error: 'Failed to load statuses' });
  }
};

// ── POST /status ──────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { text, bgColor, type } = req.body;
    const file = req.file;
    const msgType = type || (file ? (file.mimetype.startsWith('video') ? 'video' : 'image') : 'text');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const status = await Status.create({
      userId:   req.user.id,
      text:     text || null,
      mediaUrl: file ? mediaUrl(file.filename) : null,
      type:     msgType,
      bgColor:  bgColor || '#7c3aed',
      expiresAt,
      views:    [],
    });

    const full = await Status.findByPk(status.id, {
      include: [{ model: User, as: 'Author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
    });

    res.status(201).json(full);
  } catch (err) {
    console.error('create status error:', err);
    res.status(500).json({ error: 'Failed to create status' });
  }
};

// ── DELETE /status/:id ────────────────────────────────────────
exports.deleteStatus = async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await status.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete status' });
  }
};

// ── POST /status/:id/view ─────────────────────────────────────
exports.markViewed = async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });

    const views = Array.isArray(status.views) ? status.views : [];
    if (!views.includes(req.user.id)) {
      await status.update({ views: [...views, req.user.id] });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark viewed' });
  }
};
