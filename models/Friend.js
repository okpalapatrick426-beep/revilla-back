const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Friend', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  friendId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
});
