require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { sequelize } = require('./models');
const { initSocketHandlers } = require('./socket/socketHandlers');

const authRoutes = require('./routes/auth');

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

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

initSocketHandlers(io);

const PORT = process.env.PORT || 5000;

sequelize.sync({ alter: true }).then(() => {
  console.log('✅ Database synced');
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => console.error('❌ DB sync error:', err));

module.exports = { app, io };