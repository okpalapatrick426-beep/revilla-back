require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { sequelize } = require('./models');
const { initSocketHandlers } = require('./socket/socketHandlers'); // named import

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
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
});

// Make io accessible inside route handlers via req.app.get('io')
app.set('io', io);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Serve uploaded media files (images, voice notes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/products', productRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendRoutes);

// Health check — keeps server awake on Render free tier
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date(),
  uptime: process.uptime(),
}));

// Socket.io
initSocketHandlers(io);

const PORT = process.env.PORT || 5000;

sequelize.sync({ alter: true }).then(() => {
  console.log('✅ Database synced');
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => console.error('❌ DB sync error:', err));

module.exports = { app, io };
