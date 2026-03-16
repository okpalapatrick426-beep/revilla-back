const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Status, User } = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');

// Use Cloudinary if configured, otherwise disk storage
let upload;
if (process.env.CLOUDINARY_CLOUD_NAME) {
  try {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const storage = new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: 'revilla/status',
        resource_type: file.mimetype.startsWith('video') ? 'video' : 'image',
      }),
    });
    upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
  } catch {
    upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } });
  }
} else {
  upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } });
}

// GET all active statuses
router.get('/', auth, async (req, res) => {
  try {
    const statuses = await Status.findAll({
      where: { expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User, as: 'User', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(statuses);
  } catch (err) {
    console.error('Status fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// GET my statuses
router.get('/mine', auth, async (req, res) => {
  try {
    const statuses = await Status.findAll({
      where: { userId: req.user.id, expiresAt: { [Op.gt]: new Date() } },
      order: [['createdAt', 'DESC']],
    });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST create status
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const { content, type, backgroundColor, mood, expiresAt } = req.body;
    const mediaUrl = req.file?.path || req.file?.secure_url || (req.file?.filename ? `/uploads/${req.file.filename}` : null);
    const status = await Status.create({
      userId: req.user.id,
      content: content || '',
      type: type || (mediaUrl ? (req.file?.mimetype?.startsWith('video') ? 'video' : 'image') : 'text'),
      backgroundColor: backgroundColor || '#1a1a2e',
      mediaUrl,
      mood: mood || null,
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      viewers: '[]',
      viewCount: 0,
    });
    res.status(201).json(status);
  } catch (err) {
    console.error('Status create error:', err);
    res.status(500).json({ error: 'Failed: ' + err.message });
  }
});

// POST view a status
router.post('/:id/view', auth, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.userId === req.user.id) return res.json({ success: true, viewCount: status.viewCount });

    let viewers = [];
    try { viewers = JSON.parse(status.viewers || '[]'); } catch { viewers = []; }

    if (!viewers.includes(req.user.id)) {
      viewers.push(req.user.id);
      await status.update({ viewers: JSON.stringify(viewers), viewCount: viewers.length });
    }
    res.json({ success: true, viewCount: viewers.length });
  } catch (err) {
    console.error('View error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE status
router.delete('/:id', auth, async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.userId !== req.user.id) return res.status(403).json({ error: 'Not yours' });
    await status.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
