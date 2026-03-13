const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Group', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  avatar: { type: DataTypes.STRING, defaultValue: null },
  createdBy: { type: DataTypes.UUID, allowNull: false },
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: false },
  maxMembers: { type: DataTypes.INTEGER, defaultValue: 1000 },
  inviteCode: { type: DataTypes.STRING, unique: true },
  pinnedMessageId: { type: DataTypes.UUID, defaultValue: null },
});
