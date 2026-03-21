require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { sequelize } = require('./models');
const { initSocketHandlers } = require('./socket/socketHandlers');

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
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Attach io to every request so controllers can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/products', productRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendRoutes);

// Health check — used by UptimeRobot to keep server awake
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date(),
  uptime: process.uptime(),
}));

const PORT = process.env.PORT || 5000;

// Sync DB first, THEN start socket handlers and server
sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database synced');

    // Init socket AFTER DB is ready
    initSocketHandlers(io);

    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB sync error:', err);
    process.exit(1); // Force Render to show the real error instead of looping
  });

module.exports = { app, io };
