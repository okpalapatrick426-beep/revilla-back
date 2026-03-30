// socket/socketHandlers.js  — FIXED VERSION
const { User, Message } = require('../models');

const onlineUsers = new Map(); // userId -> { socketId, lastSeen, inApp }

module.exports.initSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return socket.disconnect(true);

    // ── ONLINE PRESENCE ────────────────────────────────────────
    onlineUsers.set(userId, { socketId: socket.id, lastSeen: Date.now(), inApp: true });
    User.update({ isOnline: true, lastSeen: new Date() }, { where: { id: userId } }).catch(() => {});
    io.emit('userOnline', { userId, inApp: true });

    const onlineList = Array.from(onlineUsers.entries()).map(([uid, data]) => ({
      userId: uid, inApp: data.inApp, lastSeen: data.lastSeen,
    }));
    socket.emit('onlineUsers', onlineList);
    socket.join(userId);

    // ── MESSAGING ──────────────────────────────────────────────
    socket.on('sendMessage', (msg) => {
      const targetId = msg.receiverId || msg.groupId;
      if (targetId) {
        io.to(targetId).emit('newMessage', msg);
        // Auto-deliver receipt: if recipient is online, mark as delivered
        if (onlineUsers.has(targetId)) {
          socket.emit('messageDelivered', { messageId: msg.id, deliveredTo: targetId });
        }
      }
    });

    socket.on('messageDeleted', ({ id, deletedForEveryone, to }) => {
      if (to) io.to(to).emit('messageDeleted', { id, deletedForEveryone });
    });

    // ── READ RECEIPTS — FIXED ──────────────────────────────────
    // Frontend calls:  socket.emit('markRead', { to: senderId, messageIds: [...] })
    socket.on('markRead', async ({ to, messageIds }) => {
      if (!to || !messageIds?.length) return;

      // 1. Persist readBy to database
      try {
        const msgs = await Message.findAll({ where: { id: messageIds } });
        for (const msg of msgs) {
          const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
          if (!readBy.includes(userId)) {
            await msg.update({ readBy: [...readBy, userId] });
          }
        }
      } catch (err) {
        console.error('markRead DB error:', err);
      }

      // 2. Notify sender that their messages were read
      io.to(to).emit('messagesRead', { messageIds, readBy: userId });
    });

    // ── TYPING ─────────────────────────────────────────────────
    socket.on('typing', ({ to, text }) => {
      socket.to(to).emit('typing', { userId, text: text || '' });
    });
    socket.on('stopTyping', ({ to }) => {
      socket.to(to).emit('stopTyping', { userId });
    });

    // ── VOICE / VIDEO CALL SIGNALING — NEW ────────────────────
    // Caller → callee: initiate
    socket.on('callUser', ({ to, from, fromName, fromAvatar, signal, isVideo }) => {
      io.to(to).emit('incomingCall', { from, fromName, fromAvatar, signal, isVideo });
    });

    // Callee → caller: accepted, sends back their signal
    socket.on('answerCall', ({ to, signal }) => {
      io.to(to).emit('callAccepted', { signal });
    });

    // Either side: reject / hang up
    socket.on('rejectCall', ({ to }) => {
      io.to(to).emit('callRejected');
    });
    socket.on('endCall', ({ to }) => {
      io.to(to).emit('callEnded');
    });

    // WebRTC ICE candidates relay
    socket.on('iceCandidate', ({ to, candidate }) => {
      io.to(to).emit('iceCandidate', { candidate });
    });

    // ── LOCATION ───────────────────────────────────────────────
    socket.on('shareLocation', ({ to, lat, lng, address }) => {
      io.to(to).emit('locationShared', { userId, lat, lng, address, timestamp: Date.now() });
      User.update(
        { locationLat: lat, locationLng: lng, locationUpdatedAt: new Date(), locationSharingEnabled: true },
        { where: { id: userId } }
      ).catch(() => {});
    });
    socket.on('stopSharingLocation', ({ to }) => {
      io.to(to).emit('locationStopped', { userId });
      User.update({ locationSharingEnabled: false, locationLat: null, locationLng: null }, { where: { id: userId } }).catch(() => {});
    });

    // ── HEARTBEAT ──────────────────────────────────────────────
    socket.on('heartbeat', () => {
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = Date.now();
        onlineUsers.get(userId).inApp = true;
      }
    });

    // ── DISCONNECT ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      User.update({ isOnline: false, lastSeen: new Date() }, { where: { id: userId } }).catch(() => {});
      io.emit('userOffline', { userId, lastSeen: Date.now() });
    });
  });
};
