// routes/referrals.js
const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { User } = require('../models');

// Safely load Referral model — server won't crash if not defined yet
let Referral;
try { Referral = require('../models').Referral; } catch (e) { Referral = null; }

// Get my referrals + points
r.get('/my', auth, async (req, res) => {
  try {
    if (!Referral) {
      return res.json({ referrals: [], points: 0, code: req.user.referralCode });
    }
    const referrals = await Referral.findAll({
      where: { referrerId: req.user.id },
      include: [{
        model: User, as: 'referred',
        attributes: ['id', 'username', 'displayName', 'avatar', 'createdAt'],
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ referrals, points: req.user.referralPoints || 0, code: req.user.referralCode });
  } catch (err) {
    console.error('GET /referrals/my error:', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

module.exports = r;
