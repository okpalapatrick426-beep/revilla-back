// models/Status.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Status', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:    { type: DataTypes.UUID, allowNull: false },
  mediaUrl:  { type: DataTypes.STRING, allowNull: true },     // image/video URL
  text:      { type: DataTypes.STRING(500), allowNull: true },
  type:      { type: DataTypes.ENUM('text', 'image', 'video'), defaultValue: 'text' },
  bgColor:   { type: DataTypes.STRING(20), defaultValue: '#7c3aed' }, // for text statuses
  expiresAt: { type: DataTypes.DATE, allowNull: false },       // 24 h from creation
  views:     { type: DataTypes.JSON, defaultValue: [] },       // array of userIds who viewed
});
