const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Referral', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  referrerId: { type: DataTypes.UUID, allowNull: false },
  referredId: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'completed', 'rewarded'), defaultValue: 'pending' },
  pointsAwarded: { type: DataTypes.INTEGER, defaultValue: 0 },
  completedAt: { type: DataTypes.DATE, defaultValue: null },
});
