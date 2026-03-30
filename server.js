// server.js  — FIXED VERSION
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const { initSocketHandlers } = require('./socket/socketHandlers');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
const feedRoutes = require('./routes/feed');
const productRoutes = require('./routes/products');
const referralRoutes = require('./routes/referrals');
const adminRoutes = require('./routes/admin');
const friendRoutes = require('./routes/friends');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 25e6, // 25 MB — needed for large socket payloads
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Serve uploaded media files (images & voice notes) ─────────
// Access via:  https://yourserver.com/uploads/filename.webm
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/products', productRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendRoutes);

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date(), uptime: process.uptime() })
);

// ── Multer error handler (must be after routes) ────────────────
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Max 25 MB.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket.io ─────────────────────────────────────────────────
initSocketHandlers(io);

const PORT = process.env.PORT || 5000;

sequelize.sync({ alter: true }).then(() => {
  console.log('✅ Database synced');
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => console.error('❌ DB sync error:', err));

module.exports = { app, io };
