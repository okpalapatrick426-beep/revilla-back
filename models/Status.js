const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Status', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  content: { type: DataTypes.TEXT, defaultValue: null },
  mediaUrl: { type: DataTypes.STRING, defaultValue: null },
  type: { type: DataTypes.STRING, defaultValue: 'text' },
  backgroundColor: { type: DataTypes.STRING, defaultValue: '#1a1a2e' },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  viewers: { type: DataTypes.TEXT, defaultValue: '[]' },
  viewCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: true });
