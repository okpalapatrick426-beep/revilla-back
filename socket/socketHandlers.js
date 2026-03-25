const { User } = require('../models');

// Track active socket connections: userId -> { socketId, lastSeen, inApp }
const onlineUsers = new Map();

module.exports = { initSocketHandlers };

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return;

    // ─── PRESENCE ────────────────────────────────────────────────────────────
    onlineUsers.set(String(userId), {
      socketId: socket.id,
      lastSeen: Date.now(),
      inApp: true
    });

    User.update(
      { isOnline: true, lastSeen: new Date() },
      { where: { id: userId } }
    ).catch(() => {});

    // Join personal room (for targeted events like messagesRead, calls)
    socket.join(String(userId));

    // Broadcast this user's online status
    io.emit('userOnline', { userId, inApp: true });

    // Send current online list to newly connected user
    const onlineList = Array.from(onlineUsers.entries()).map(([uid, data]) => ({
      userId: uid,
      inApp: data.inApp,
      lastSeen: data.lastSeen,
    }));
    socket.emit('onlineUsers', onlineList);

    // ─── DM ROOM MANAGEMENT ──────────────────────────────────────────────────
    // Frontend calls joinRoom('dm:userId1-userId2') when opening a chat
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
    });

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
    });

    // ─── MESSAGING ───────────────────────────────────────────────────────────
    // The backend REST endpoint (messageController) is the source of truth for
    // message creation and emitting 'newMessage'. This socket handler is a
    // fallback for direct socket sends (e.g. from another device).
    socket.on('sendMessage', (msg) => {
      if (!msg) return;
      // Route to DM room or group room
      const room = msg.groupId
        ? `group:${msg.groupId}`
        : `dm:${[String(userId), String(msg.receiverId || msg.recipientId)].sort().join('-')}`;
      socket.to(room).emit('newMessage', msg);

      // Also emit to recipient's personal room as fallback
      const recipientId = msg.receiverId || msg.recipientId;
      if (recipientId) {
        socket.to(String(recipientId)).emit('newMessage', msg);
      }
    });

    socket.on('messageDeleted', ({ id, deletedForEveryone, to }) => {
      if (to) io.to(to).emit('messageDeleted', { id, deletedForEveryone });
    });

    // ─── READ RECEIPTS ────────────────────────────────────────────────────────
    // Frontend emits this when user opens a conversation
    socket.on('markRead', ({ to, messageIds }) => {
      // 'to' is the senderId of the messages being read
      io.to(String(to)).emit('messagesRead', {
        messageIds,
        readBy: userId,
        conversationWith: userId,
      });
    });

    // ─── TYPING ──────────────────────────────────────────────────────────────
    socket.on('typing', ({ to, text }) => {
      // 'to' is the other user's ID
      socket.to(String(to)).emit('typing', { userId, text: text || '' });
    });

    socket.on('stopTyping', ({ to }) => {
      socket.to(String(to)).emit('stopTyping', { userId });
    });

    // ─── WEBRTC VOICE/VIDEO CALLS ─────────────────────────────────────────────
    socket.on('callUser', ({ to, signal, isVideo }) => {
      io.to(String(to)).emit('incomingCall', {
        from: userId,
        signal,
        isVideo: !!isVideo,
      });
    });

    socket.on('acceptCall', ({ to, signal }) => {
      io.to(String(to)).emit('callAccepted', { signal });
    });

    socket.on('rejectCall', ({ to }) => {
      io.to(String(to)).emit('callRejected', { by: userId });
    });

    socket.on('endCall', ({ to }) => {
      io.to(String(to)).emit('callEnded', { by: userId });
    });

    // ─── HEARTBEAT ────────────────────────────────────────────────────────────
    socket.on('heartbeat', () => {
      const u = onlineUsers.get(String(userId));
      if (u) {
        u.lastSeen = Date.now();
        u.inApp = true;
      }
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(String(userId));
      User.update(
        { isOnline: false, lastSeen: new Date() },
        { where: { id: userId } }
      ).catch(() => {});
      io.emit('userOffline', { userId, lastSeen: Date.now() });
    });
  });
}
