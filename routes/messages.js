// routes/messages.js
const express = require('express');
const r = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const c = require('../controllers/messageController');
const { auth } = require('../middleware/auth');

// ─── Multer storage for media uploads ─────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes('webm') ? '.webm' : file.mimetype.includes('ogg') ? '.ogg' : file.mimetype.includes('mp4') ? '.mp4' : '.bin');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'video/webm', 'video/mp4'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Serve uploaded files statically — add this line in server.js too:
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
r.get('/conversations', auth, c.getConversations);
r.get('/:userId', auth, c.getConversation);
r.get('/group/:groupId', auth, c.getGroupMessages);
r.post('/', auth, upload.single('media'), c.sendMessage);
r.delete('/:id', auth, c.deleteMessage);
r.post('/:id/react', auth, c.reactToMessage);
r.post('/mark-read', auth, c.markRead);

module.exports = r;
