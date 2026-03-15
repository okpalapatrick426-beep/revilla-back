const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Referral', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  referrerId: { type: DataTypes.UUID, allowNull: false },
  referredId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  pointsAwarded: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: true });
