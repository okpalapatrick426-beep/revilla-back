// routes/feed.js  — NEW
const express  = require('express');
const r        = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const c        = require('../controllers/feedController');
const { auth } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `feed-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

r.get('/',              auth, c.getFeed);
r.post('/',             auth, upload.single('media'), c.createPost);
r.post('/:id/like',     auth, c.toggleLike);
r.post('/:id/comment',  auth, c.addComment);
r.delete('/:id',        auth, c.deletePost);

module.exports = r;
