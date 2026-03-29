const { User, Message } = require('../models');

// Track active socket connections
const onlineUsers = new Map(); // userId -> { socketId, lastSeen, inApp }

const initSocketHandlers = (io) => {
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

      // Mark as delivered if recipient is online
      if (msg.receiverId && onlineUsers.has(msg.receiverId)) {
        io.to(msg.senderId).emit('messageDelivered', { messageId: msg.id, to: msg.receiverId });
        if (msg.id) {
          Message.findByPk(msg.id).then(m => {
            if (m) {
              const delivered = Array.isArray(m.deliveredTo) ? m.deliveredTo : [];
              if (!delivered.includes(msg.receiverId)) {
                delivered.push(msg.receiverId);
                m.update({ deliveredTo: delivered });
              }
            }
          }).catch(() => {});
        }
      }
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

    // ─── READ RECEIPTS (persisted to DB) ─────────────────────
    socket.on('markRead', async ({ to, messageIds }) => {
      if (!messageIds || !messageIds.length) return;
      try {
        // Persist readBy to DB for each message
        const messages = await Message.findAll({ where: { id: messageIds } });
        for (const msg of messages) {
          const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
          if (!readBy.includes(userId)) {
            readBy.push(userId);
            await msg.update({ readBy });
          }
        }
        // Notify sender their messages were read
        socket.to(to).emit('messagesRead', { messageIds, readBy: userId });
      } catch (err) {
        console.error('markRead error:', err);
      }
    });

    // ─── FRIEND REQUEST NOTIFICATIONS ────────────────────────
    socket.on('friendRequest', ({ to, from }) => {
      io.to(to).emit('friendRequest', { from });
    });

    socket.on('friendAccepted', ({ to, from }) => {
      io.to(to).emit('friendAccepted', { from });
    });

    // ─── VOICE / VIDEO CALL SIGNALING ────────────────────────
    socket.on('callOffer', ({ to, offer, callType, callerInfo }) => {
      io.to(to).emit('callOffer', {
        from: userId,
        offer,
        callType, // 'voice' | 'video'
        callerInfo,
      });
    });

    socket.on('callAnswer', ({ to, answer }) => {
      io.to(to).emit('callAnswer', { from: userId, answer });
    });

    socket.on('iceCandidate', ({ to, candidate }) => {
      io.to(to).emit('iceCandidate', { from: userId, candidate });
    });

    socket.on('callEnd', ({ to }) => {
      io.to(to).emit('callEnd', { from: userId });
    });

    socket.on('callReject', ({ to }) => {
      io.to(to).emit('callReject', { from: userId });
    });

    socket.on('callBusy', ({ to }) => {
      io.to(to).emit('callBusy', { from: userId });
    });

    // ─── LOCATION SHARING (opt-in) ────────────────────────────
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

module.exports = { initSocketHandlers };
