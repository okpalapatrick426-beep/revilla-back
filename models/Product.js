const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Product', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sellerId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.FLOAT, allowNull: false },
  currency: { type: DataTypes.STRING, defaultValue: 'USD' },
  category: { type: DataTypes.STRING },
  images: { type: DataTypes.JSON, defaultValue: [] },
  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  likes: { type: DataTypes.JSON, defaultValue: [] },
});
