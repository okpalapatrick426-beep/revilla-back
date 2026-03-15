const { User } = require('../models');

// Track active socket connections
const onlineUsers = new Map(); // userId -> { socketId, lastSeen, inApp }

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return;

    // Mark user as online and IN APP
    onlineUsers.set(userId, { socketId: socket.id, lastSeen: Date.now(), inApp: true });
    User.update({ isOnline: true, lastSeen: new Date() }, { where: { id: userId } }).catch(() => {});

    // Broadcast to everyone that this user is now online
    io.emit('userOnline', { userId, inApp: true });

    // Send current online users list to the newly connected user
    const onlineList = Array.from(onlineUsers.entries()).map(([uid, data]) => ({
      userId: uid,
      inApp: data.inApp,
      lastSeen: data.lastSeen,
    }));
    socket.emit('onlineUsers', onlineList);

    // Join personal room
    socket.join(userId);

    // ─── MESSAGING ───────────────────────────────────────────
    socket.on('sendMessage', (msg) => {
      const targetId = msg.receiverId || msg.groupId;
      if (targetId) io.to(targetId).emit('newMessage', msg);
    });

    socket.on('messageDeleted', ({ id, deletedForEveryone, to }) => {
      if (to) io.to(to).emit('messageDeleted', { id, deletedForEveryone });
    });

    // ─── TYPING (with live text preview) ─────────────────────
    socket.on('typing', ({ to, text }) => {
      socket.to(to).emit('typing', { userId, text: text || '' });
    });

    socket.on('stopTyping', ({ to }) => {
      socket.to(to).emit('stopTyping', { userId });
    });

    // ─── LOCATION SHARING (opt-in) ────────────────────────────
    socket.on('shareLocation', ({ to, lat, lng, address }) => {
      io.to(to).emit('locationShared', { userId, lat, lng, address, timestamp: Date.now() });
      // Also persist to DB
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

    // ─── READ RECEIPTS ────────────────────────────────────────
    socket.on('markRead', ({ to, messageIds }) => {
      socket.to(to).emit('messagesRead', { messageIds, readBy: userId });
    });

    // ─── HEARTBEAT (keeps "in app" status accurate) ───────────
    socket.on('heartbeat', () => {
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = Date.now();
        onlineUsers.get(userId).inApp = true;
      }
    });

    // ─── DISCONNECT ───────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      User.update({ isOnline: false, lastSeen: new Date() }, { where: { id: userId } }).catch(() => {});
      io.emit('userOffline', { userId, lastSeen: Date.now() });
    });
  });
};
