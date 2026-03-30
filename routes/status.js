// routes/status.js  — COMPLETE VERSION
const express  = require('express');
const r        = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const c        = require('../controllers/statusController');
const { auth } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `status-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB for video

r.get('/',          auth, c.getStatuses);                     // get all active statuses
r.post('/',         auth, upload.single('media'), c.create);  // create status
r.delete('/:id',    auth, c.deleteStatus);                    // delete own status
r.post('/:id/view', auth, c.markViewed);                      // mark as viewed

module.exports = r;
