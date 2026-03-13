const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Role', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  permissions: { type: DataTypes.JSON, defaultValue: [] },
  color: { type: DataTypes.STRING, defaultValue: '#00e5ff' },
});
