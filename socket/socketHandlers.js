const { User } = require('../models');

const onlineUsers = new Map(); // userId -> { socketId, lastSeen, inApp }

const initSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return;

    // Mark online + in app
    onlineUsers.set(userId, { socketId: socket.id, lastSeen: Date.now(), inApp: true });
    User.update({ isOnline: true, lastSeen: new Date() }, { where: { id: userId } }).catch(() => {});

    // Broadcast to everyone
    io.emit('userOnline', { userId, inApp: true });

    // Send current online list to new user
    const onlineList = Array.from(onlineUsers.entries()).map(([uid, data]) => ({
      userId: uid, inApp: data.inApp, lastSeen: data.lastSeen,
    }));
    socket.emit('onlineUsers', onlineList);

    // Join personal room (for DMs directed at this user)
    socket.join(userId);

    // ── ROOM MANAGEMENT ───────────────────────────────────────────────────
    // Frontend calls joinRoom('dm:user1-user2') when opening a chat
    socket.on('joinRoom', (room) => {
      socket.join(room);
    });

    socket.on('leaveRoom', (room) => {
      socket.leave(room);
    });

    // ── MESSAGING ─────────────────────────────────────────────────────────
    socket.on('sendMessage', (msg) => {
      // Broadcast to the DM room so the other person gets it instantly
      const recipientId = msg.recipientId || msg.receiverId || msg.to;
      if (recipientId) {
        // Emit to recipient's personal room
        socket.to(recipientId).emit('newMessage', msg);
        // Also emit to the shared DM room (both sides joined)
        const roomId = [userId, recipientId].sort().join('-');
        socket.to(`dm:${roomId}`).emit('newMessage', msg);
      }
      if (msg.groupId) {
        socket.to(`group:${msg.groupId}`).emit('newMessage', msg);
      }
    });

    socket.on('messageDeleted', ({ id, deletedForEveryone, to }) => {
      if (to) {
        socket.to(to).emit('messageDeleted', { id, deletedForEveryone });
        const roomId = [userId, to].sort().join('-');
        socket.to(`dm:${roomId}`).emit('messageDeleted', { id, deletedForEveryone });
      }
    });

    // ── TYPING ────────────────────────────────────────────────────────────
    socket.on('typing', ({ to, text }) => {
      // Send to recipient's personal room + DM room
      socket.to(to).emit('typing', { userId, text: text || '' });
      const roomId = [userId, to].sort().join('-');
      socket.to(`dm:${roomId}`).emit('typing', { userId, text: text || '' });
    });

    socket.on('stopTyping', ({ to }) => {
      socket.to(to).emit('stopTyping', { userId });
      const roomId = [userId, to].sort().join('-');
      socket.to(`dm:${roomId}`).emit('stopTyping', { userId });
    });

    // ── LOCATION ──────────────────────────────────────────────────────────
    socket.on('shareLocation', ({ to, lat, lng, address }) => {
      io.to(to).emit('locationShared', { userId, lat, lng, address, timestamp: Date.now() });
      User.update(
        { locationLat: lat, locationLng: lng, locationUpdatedAt: new Date(), locationSharingEnabled: true },
        { where: { id: userId } }
      ).catch(() => {});
    });

    socket.on('stopSharingLocation', ({ to }) => {
      io.to(to).emit('locationStopped', { userId });
      User.update(
        { locationSharingEnabled: false, locationLat: null, locationLng: null },
        { where: { id: userId } }
      ).catch(() => {});
    });

    // ── READ RECEIPTS ─────────────────────────────────────────────────────
    socket.on('markRead', ({ to, messageIds }) => {
      socket.to(to).emit('messagesRead', { messageIds, readBy: userId });
    });

    // ── HEARTBEAT ─────────────────────────────────────────────────────────
    socket.on('heartbeat', () => {
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = Date.now();
        onlineUsers.get(userId).inApp = true;
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      User.update({ isOnline: false, lastSeen: new Date() }, { where: { id: userId } }).catch(() => {});
      io.emit('userOffline', { userId, lastSeen: Date.now() });
    });
  });
};

module.exports = { initSocketHandlers };
