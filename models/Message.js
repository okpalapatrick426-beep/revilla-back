const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  senderId: { type: DataTypes.UUID, allowNull: false },
  recipientId: { type: DataTypes.UUID, allowNull: true },
  groupId: { type: DataTypes.UUID, allowNull: true },
  content: { type: DataTypes.TEXT },
  type: { type: DataTypes.STRING, defaultValue: 'text' },
  mediaUrl: { type: DataTypes.STRING, defaultValue: null },
  replyToId: { type: DataTypes.UUID, defaultValue: null },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readBy: { type: DataTypes.JSON, defaultValue: [] },       // array of userIds who read it
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }, // soft delete for sender only
  deletedForEveryone: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedFor: { type: DataTypes.JSON, defaultValue: [] },
  reactions: { type: DataTypes.JSON, defaultValue: {} },    // { emoji: [userId, ...] }
});
