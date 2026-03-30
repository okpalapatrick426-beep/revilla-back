// models/index.js  — FIXED VERSION (ensure associations are correct)
'use strict';

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME     || 'revilla',
  process.env.DB_USER     || 'root',
  process.env.DB_PASSWORD || '',
  {
    host:    process.env.DB_HOST    || 'localhost',
    dialect: process.env.DB_DIALECT || 'mysql',   // or 'postgres' / 'sqlite'
    logging: false,
  }
);

// ── Load models ───────────────────────────────────────────────
const User       = require('./User')(sequelize);
const Message    = require('./Message')(sequelize);
const Friendship = require('./Friendship')(sequelize);
const Status     = require('./Status')(sequelize);
const Post       = require('./Post')(sequelize);
const Comment    = require('./Comment')(sequelize);

// ── Associations ──────────────────────────────────────────────

// Friendship ↔ User
Friendship.belongsTo(User, { foreignKey: 'requesterId', as: 'Requester' });
Friendship.belongsTo(User, { foreignKey: 'receiverId',  as: 'Receiver'  });
User.hasMany(Friendship,   { foreignKey: 'requesterId', as: 'SentRequests'     });
User.hasMany(Friendship,   { foreignKey: 'receiverId',  as: 'ReceivedRequests' });

// Message ↔ User
Message.belongsTo(User, { foreignKey: 'senderId',    as: 'Sender'    });
Message.belongsTo(User, { foreignKey: 'recipientId', as: 'Recipient' });

// Status ↔ User
Status.belongsTo(User, { foreignKey: 'userId', as: 'Author' });
User.hasMany(Status,   { foreignKey: 'userId', as: 'Statuses' });

// Post ↔ User
Post.belongsTo(User, { foreignKey: 'userId', as: 'Author' });
User.hasMany(Post,   { foreignKey: 'userId', as: 'Posts' });

// Comment ↔ Post ↔ User
Comment.belongsTo(Post, { foreignKey: 'postId', as: 'Post' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'Author' });
Post.hasMany(Comment,   { foreignKey: 'postId', as: 'Comments' });

module.exports = { sequelize, Sequelize, User, Message, Friendship, Status, Post, Comment };
