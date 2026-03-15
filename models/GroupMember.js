const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('GroupMember', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  groupId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'member' },
}, { timestamps: true });
