const express = require('express');
const r = express.Router();
const c = require('../controllers/adminController');
const { auth, adminOnly, modOrAdmin } = require('../middleware/auth');

r.get('/stats', auth, modOrAdmin, c.getDashboardStats);
r.get('/users', auth, modOrAdmin, c.getAllUsers);
r.put('/users/:id/ban', auth, modOrAdmin, c.banUser);
r.put('/users/:id/unban', auth, modOrAdmin, c.unbanUser);
r.put('/users/:id/role', auth, adminOnly, c.updateUserRole);
// Only returns users who have EXPLICITLY opted in to location sharing
r.get('/location-optins', auth, modOrAdmin, c.getLocationOptIns);
r.get('/groups/:groupId/messages', auth, modOrAdmin, c.getGroupMessagesForModeration);
r.delete('/messages/:id', auth, modOrAdmin, c.adminDeleteMessage);
r.get('/referrals', auth, modOrAdmin, c.getReferralStats);

module.exports = r;
