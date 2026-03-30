// models/Post.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Post', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:   { type: DataTypes.UUID, allowNull: false },
  content:  { type: DataTypes.TEXT, defaultValue: '' },
  mediaUrl: { type: DataTypes.STRING, allowNull: true },
  likes:    { type: DataTypes.JSON, defaultValue: [] }, // array of userIds
});

// models/Comment.js
// (put in its own file: models/Comment.js)
