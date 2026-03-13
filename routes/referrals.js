// routes/referrals.js
const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { Referral, User } = require('../models');

r.get('/my', auth, async (req, res) => {
  const referrals = await Referral.findAll({
    where: { referrerId: req.user.id },
    include: [{ model: User, as: 'referred', attributes: ['id', 'username', 'displayName', 'avatar', 'createdAt'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ referrals, points: req.user.referralPoints, code: req.user.referralCode });
});

module.exports = r;
