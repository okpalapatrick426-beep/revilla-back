// routes/messages.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/messageController');
const { auth } = require('../middleware/auth');

// Multer for image/voice uploads
let upload;
try {
  const multer = require('multer');
  const path   = require('path');
  const fs     = require('fs');

  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      const allowed = /image|video|audio/;
      cb(null, allowed.test(file.mimetype));
    },
  });
} catch (e) {
  // multer not installed — use no-op middleware
  upload = { single: () => (req, res, next) => next() };
  console.warn('multer not available — file uploads disabled');
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
// Conversations list — MUST come before /:id style routes
r.get('/conversations',        auth, c.getConversations);
r.get('/conversation/:userId', auth, c.getConversation);
r.get('/group/:groupId',       auth, c.getGroupMessages);

// Send message — supports JSON body OR multipart/form-data (with file)
r.post('/', auth, upload.single('media'), c.sendMessage);

r.delete('/:id',       auth, c.deleteMessage);
r.post('/:id/react',   auth, c.reactToMessage);

module.exports = r;
