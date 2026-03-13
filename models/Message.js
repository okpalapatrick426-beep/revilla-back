const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  senderId: { type: DataTypes.UUID, allowNull: false },
  recipientId: { type: DataTypes.UUID, defaultValue: null }, // null = group message
  groupId: { type: DataTypes.UUID, defaultValue: null },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  type: { type: DataTypes.ENUM('text', 'image', 'voice', 'video', 'file', 'system'), defaultValue: 'text' },
  mediaUrl: { type: DataTypes.STRING, defaultValue: null },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedForEveryone: { type: DataTypes.BOOLEAN, defaultValue: false },
  isEdited: { type: DataTypes.BOOLEAN, defaultValue: false },
  reactions: { type: DataTypes.JSON, defaultValue: {} },
  replyToId: { type: DataTypes.UUID, defaultValue: null },
  readBy: { type: DataTypes.JSON, defaultValue: [] },
  deliveredTo: { type: DataTypes.JSON, defaultValue: [] },
});
