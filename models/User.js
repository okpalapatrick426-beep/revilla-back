const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  displayName: { type: DataTypes.STRING },
  avatar: { type: DataTypes.STRING, defaultValue: null },
  bio: { type: DataTypes.TEXT, defaultValue: '' },
  role: { type: DataTypes.STRING, defaultValue: 'user' },
  isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastSeen: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  locationSharingEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  locationLat: { type: DataTypes.FLOAT, defaultValue: null },
  locationLng: { type: DataTypes.FLOAT, defaultValue: null },
  locationUpdatedAt: { type: DataTypes.DATE, defaultValue: null },
  showOnlineStatus: { type: DataTypes.BOOLEAN, defaultValue: true },
  readReceipts: { type: DataTypes.BOOLEAN, defaultValue: true },
  notificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  isBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  referralCode: { type: DataTypes.STRING, unique: true },
  referredBy: { type: DataTypes.UUID, defaultValue: null },
  followersCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  followingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  timestamps: true,
  hooks: {
    beforeCreate: (user) => {
      if (!user.referralCode) {
        user.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
    }
  }
});
