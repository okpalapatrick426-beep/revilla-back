// routes/messages.js  — FIXED VERSION
const express = require('express');
const r = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const c = require('../controllers/messageController');
const { auth } = require('../middleware/auth');

// ── Multer setup for voice + image uploads ─────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes('webm') ? '.webm' : '');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];
  cb(null, allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } }); // 25 MB

// ── Routes ─────────────────────────────────────────────────────
// GET messages for a 1-on-1 conversation  (ChatWindow uses /messages/:userId)
r.get('/:userId', auth, c.getConversation);
r.get('/conversation/:userId', auth, c.getConversation); // keep old path too
r.get('/group/:groupId', auth, c.getGroupMessages);

// POST send message — handles both JSON text and multipart media
r.post('/', auth, upload.single('media'), c.sendMessage);

// DELETE message
r.delete('/:id', auth, c.deleteMessage);

// POST react to message
r.post('/:id/react', auth, c.reactToMessage);

// POST mark messages as read
r.post('/read', auth, c.markRead);

module.exports = r;
