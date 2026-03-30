// models/Comment.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Comment', {
  id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  postId:  { type: DataTypes.UUID, allowNull: false },
  userId:  { type: DataTypes.UUID, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
});
