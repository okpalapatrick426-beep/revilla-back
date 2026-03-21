const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Status', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  content: { type: DataTypes.TEXT },
  mediaUrl: { type: DataTypes.STRING, defaultValue: null },
  type: { type: DataTypes.STRING, defaultValue: 'text' },
  backgroundColor: { type: DataTypes.STRING, defaultValue: '#1a1a2e' },
  views: { type: DataTypes.JSON, defaultValue: [] },
  expiresAt: { type: DataTypes.DATE },
});
