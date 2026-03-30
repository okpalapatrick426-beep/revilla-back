// routes/friends.js  — COMPLETE VERSION
const express = require('express');
const r = express.Router();
const c = require('../controllers/friendController');
const { auth } = require('../middleware/auth');

r.get('/',                auth, c.getFriends);        // list all friendships for current user
r.post('/request',        auth, c.sendRequest);       // send friend request
r.post('/accept',         auth, c.accept);            // accept incoming request
r.post('/decline',        auth, c.decline);           // decline incoming request
r.delete('/unfriend/:id', auth, c.unfriend);          // remove a friend
r.get('/suggestions',     auth, c.getSuggestions);    // people you may know

module.exports = r;
