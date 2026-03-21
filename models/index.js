const { Sequelize } = require('sequelize');

// ─── DATABASE CONNECTION ──────────────────────────────────────────────────────
// DATABASE_URL must be set in Render environment variables
// Go to: Render Dashboard → revilla-back → Environment → Add DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('   Go to Render Dashboard → revilla-back → Environment → set DATABASE_URL');
}

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/revilla', {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

// ─── MODELS ───────────────────────────────────────────────────────────────────
const User       = require('./User')(sequelize);
const Message    = require('./Message')(sequelize);
const Status     = require('./Status')(sequelize);
const Product    = require('./Product')(sequelize);
const Referral   = require('./Referral')(sequelize);
const Friend     = require('./Friend')(sequelize);
const Role       = require('./Role')(sequelize);
const Group      = require('./Group')(sequelize);
const GroupMember = require('./GroupMember')(sequelize);

// ─── ASSOCIATIONS ─────────────────────────────────────────────────────────────

// Messages
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

// Status / Stories
User.hasMany(Status, { foreignKey: 'userId' });
Status.belongsTo(User, { foreignKey: 'userId' });

// Marketplace
User.hasMany(Product, { foreignKey: 'sellerId', as: 'products' });
Product.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

// Referrals
User.hasMany(Referral, { foreignKey: 'referrerId', as: 'referrals' });
Referral.belongsTo(User, { foreignKey: 'referrerId', as: 'referrer' });
Referral.belongsTo(User, { foreignKey: 'referredId', as: 'referred' });

// Friends (self-referential many-to-many through Friend junction table)
User.belongsToMany(User, {
  through: Friend,
  as: 'friends',
  foreignKey: 'userId',
  otherKey: 'friendId',
});

// Groups
Group.hasMany(GroupMember, { foreignKey: 'groupId' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });
GroupMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(GroupMember, { foreignKey: 'userId' });

// Group messages
Group.hasMany(Message, { foreignKey: 'groupId', as: 'messages' });
Message.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  sequelize,
  User,
  Message,
  Status,
  Product,
  Referral,
  Friend,
  Role,
  Group,
  GroupMember,
};
