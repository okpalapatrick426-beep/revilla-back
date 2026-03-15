const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Friend', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requesterId: { type: DataTypes.UUID, allowNull: false },
  receiverId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
}, { timestamps: true });
