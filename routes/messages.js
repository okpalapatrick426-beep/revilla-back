// routes/messages.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/messageController');
const { auth } = require('../middleware/auth');
r.get('/conversation/:userId', auth, c.getConversation);
r.get('/group/:groupId', auth, c.getGroupMessages);
r.post('/', auth, c.sendMessage);
r.delete('/:id', auth, c.deleteMessage);
r.post('/:id/react', auth, c.reactToMessage);
module.exports = r;
