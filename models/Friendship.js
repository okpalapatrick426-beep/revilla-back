// models/Friendship.js  — ensure this exists
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Friendship', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requesterId: { type: DataTypes.UUID, allowNull: false },
  receiverId:  { type: DataTypes.UUID, allowNull: false },
  status:      { type: DataTypes.ENUM('pending', 'accepted', 'declined', 'blocked'), defaultValue: 'pending' },
}, {
  indexes: [
    // Prevent duplicate pairs
    { unique: true, fields: ['requesterId', 'receiverId'] },
  ],
});
