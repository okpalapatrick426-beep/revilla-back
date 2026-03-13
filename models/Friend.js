const { DataTypes } = require('sequelize');

// Friend.js
const Friend = (sequelize) => sequelize.define('Friend', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  friendId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'accepted', 'blocked'), defaultValue: 'pending' },
});

module.exports = Friend;
