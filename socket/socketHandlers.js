const jwt = require('jsonwebtoken');
const { User, Message } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const onlineUsers = new Map(); // userId -> socketId

const initSocketHandlers = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user || user.isBanned) return next(new Error('Not authorized'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`🔌 ${user.username} connected`);

    // Mark online
    onlineUsers.set(user.id, socket.id);
    await user.update({ isOnline: true, lastSeen: new Date() });
    io.emit('user_online', { userId: user.id });

    // Join personal room
    socket.join(`user:${user.id}`);

    // Join DM rooms
    socket.on('join_dm', ({ userId }) => {
      const room = `dm:${[user.id, userId].sort().join('-')}`;
      socket.join(room);
    });

    // Join group room
    socket.on('join_group', ({ groupId }) => {
      socket.join(`group:${groupId}`);
    });

    // Typing indicators
    socket.on('typing_start', ({ recipientId, groupId }) => {
      const room = groupId ? `group:${groupId}` : `dm:${[user.id, recipientId].sort().join('-')}`;
      socket.to(room).emit('typing', { userId: user.id, username: user.displayName });
    });

    socket.on('typing_stop', ({ recipientId, groupId }) => {
      const room = groupId ? `group:${groupId}` : `dm:${[user.id, recipientId].sort().join('-')}`;
      socket.to(room).emit('stop_typing', { userId: user.id });
    });

    // Real-time message send via socket
    socket.on('send_message', async ({ recipientId, groupId, content, type, replyToId }) => {
      try {
        const message = await Message.create({
          senderId: user.id, recipientId, groupId,
          content, type: type || 'text', replyToId,
        });
        const full = await Message.findByPk(message.id, {
          include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'avatar'] }]
        });
        const room = groupId ? `group:${groupId}` : `dm:${[user.id, recipientId].sort().join('-')}`;
        io.to(room).emit('new_message', full);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Read receipts
    socket.on('mark_read', async ({ messageId, senderId }) => {
      const msg = await Message.findByPk(messageId);
      if (msg) {
        const readBy = msg.readBy || [];
        if (!readBy.includes(user.id)) {
          readBy.push(user.id);
          await msg.update({ readBy });
          io.to(`user:${senderId}`).emit('message_read', { messageId, readBy: user.id });
        }
      }
    });

    // OPT-IN: User shares location update (only if they've enabled it)
    socket.on('update_location', async ({ lat, lng }) => {
      if (!user.locationSharingEnabled) {
        socket.emit('error', { message: 'Location sharing not enabled. Enable it in settings first.' });
        return;
      }
      await user.update({ locationLat: lat, locationLng: lng, locationUpdatedAt: new Date() });
      // Broadcast to admin room only
      io.to('admin_room').emit('user_location_update', {
        userId: user.id, username: user.username, lat, lng, updatedAt: new Date()
      });
    });

    // Admin joins admin room
    if (user.role === 'admin' || user.role === 'moderator') {
      socket.join('admin_room');
    }

    // Disconnect
    socket.on('disconnect', async () => {
      onlineUsers.delete(user.id);
      await user.update({ isOnline: false, lastSeen: new Date() });
      io.emit('user_offline', { userId: user.id, lastSeen: new Date() });
      console.log(`❌ ${user.username} disconnected`);
    });
  });
};

module.exports = { initSocketHandlers, onlineUsers };
