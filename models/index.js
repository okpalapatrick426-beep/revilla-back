const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: false,
});

// Import models
const User = require('./User')(sequelize);
const Message = require('./Message')(sequelize);
const Status = require('./Status')(sequelize);
const Product = require('./Product')(sequelize);
const Referral = require('./Referral')(sequelize);
const Friend = require('./Friend')(sequelize);
const Role = require('./Role')(sequelize);
const Group = require('./Group')(sequelize);
const GroupMember = require('./GroupMember')(sequelize);

// Associations
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

User.hasMany(Status, { foreignKey: 'userId' });
Status.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Product, { foreignKey: 'sellerId' });
Product.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

User.hasMany(Referral, { foreignKey: 'referrerId', as: 'referrals' });
Referral.belongsTo(User, { foreignKey: 'referrerId', as: 'referrer' });
Referral.belongsTo(User, { foreignKey: 'referredId', as: 'referred' });

User.belongsToMany(User, { through: Friend, as: 'friends', foreignKey: 'userId', otherKey: 'friendId' });

Group.hasMany(GroupMember, { foreignKey: 'groupId' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });
GroupMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(GroupMember, { foreignKey: 'userId' });

module.exports = {
  sequelize, User, Message, Status, Product, Referral, Friend, Role, Group, GroupMember
};
