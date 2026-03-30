// controllers/friendController.js  — COMPLETE VERSION
const { Friendship, User } = require('../models');
const { Op } = require('sequelize');

// ── GET /friends  — list all friendships for current user ─────
exports.getFriends = async (req, res) => {
  try {
    const me = req.user.id;
    const rows = await Friendship.findAll({
      where: {
        [Op.or]: [{ requesterId: me }, { receiverId: me }],
      },
      include: [
        { model: User, as: 'Requester', attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'] },
        { model: User, as: 'Receiver',  attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'] },
      ],
    });
    res.json(rows);
  } catch (err) {
    console.error('getFriends error:', err);
    res.status(500).json({ error: 'Failed to load friends' });
  }
};

// ── POST /friends/request ─────────────────────────────────────
exports.sendRequest = async (req, res) => {
  try {
    const me = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId || receiverId === me) {
      return res.status(400).json({ error: 'Invalid receiverId' });
    }

    // Don't allow duplicate requests
    const existing = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requesterId: me, receiverId },
          { requesterId: receiverId, receiverId: me },
        ],
      },
    });
    if (existing) return res.status(409).json({ error: 'Request already exists', status: existing.status });

    const friendship = await Friendship.create({ requesterId: me, receiverId, status: 'pending' });
    res.status(201).json(friendship);
  } catch (err) {
    console.error('sendRequest error:', err);
    res.status(500).json({ error: 'Failed to send request' });
  }
};

// ── POST /friends/accept ──────────────────────────────────────
exports.accept = async (req, res) => {
  try {
    const me = req.user.id;
    const { requesterId } = req.body;

    const friendship = await Friendship.findOne({
      where: { requesterId, receiverId: me, status: 'pending' },
    });
    if (!friendship) return res.status(404).json({ error: 'Request not found' });

    await friendship.update({ status: 'accepted' });
    res.json(friendship);
  } catch (err) {
    console.error('accept error:', err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
};

// ── POST /friends/decline ─────────────────────────────────────
exports.decline = async (req, res) => {
  try {
    const me = req.user.id;
    const { requesterId } = req.body;

    await Friendship.destroy({
      where: { requesterId, receiverId: me, status: 'pending' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('decline error:', err);
    res.status(500).json({ error: 'Failed to decline request' });
  }
};

// ── DELETE /friends/unfriend/:id ──────────────────────────────
exports.unfriend = async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.id;

    await Friendship.destroy({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: me, receiverId: other },
          { requesterId: other, receiverId: me },
        ],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('unfriend error:', err);
    res.status(500).json({ error: 'Failed to unfriend' });
  }
};

// ── GET /friends/suggestions ──────────────────────────────────
// Returns users who are NOT yet friends/pending with current user
exports.getSuggestions = async (req, res) => {
  try {
    const me = req.user.id;
    const rows = await Friendship.findAll({
      where: {
        [Op.or]: [{ requesterId: me }, { receiverId: me }],
      },
      attributes: ['requesterId', 'receiverId'],
    });

    const knownIds = new Set([me]);
    rows.forEach(r => { knownIds.add(r.requesterId); knownIds.add(r.receiverId); });

    const suggestions = await User.findAll({
      where: { id: { [Op.notIn]: Array.from(knownIds) } },
      attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline'],
      limit: 20,
    });
    res.json(suggestions);
  } catch (err) {
    console.error('getSuggestions error:', err);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};
