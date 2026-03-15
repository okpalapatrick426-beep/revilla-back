const jwt = require('jsonwebtoken');
const { User } = require('../models');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'revilla2026';

// Called after Supabase magic link login — syncs user to our DB
const supabaseSync = async (req, res) => {
  try {
    const { supabaseId, email, displayName, referralCode } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const cleanEmail = email.toLowerCase().trim();

    // Find or create user in our DB
    let user = await User.findOne({ where: { email: cleanEmail } });

    if (!user) {
      // New user — create account
      const baseUsername = (displayName || cleanEmail.split('@')[0])
        .toLowerCase().replace(/[^a-z0-9]/gi, '').substring(0, 15);
      let username = baseUsername;

      // Ensure unique username
      let attempt = 0;
      while (await User.findOne({ where: { username } })) {
        attempt++;
        username = `${baseUsername}${Math.floor(Math.random() * 9999)}`;
        if (attempt > 10) break;
      }

      let referredBy = null;
      if (referralCode) {
        const referrer = await User.findOne({ where: { referralCode } });
        if (referrer) referredBy = referrer.id;
      }

      user = await User.create({
        email: cleanEmail,
        username,
        displayName: displayName || username,
        password: crypto.randomBytes(32).toString('hex'), // never used
        referredBy,
        isVerified: true, // Supabase verified their email
      });
    } else {
      // Existing user — update online status
      await user.update({ isOnline: true, lastSeen: new Date(), isVerified: true });
    }

    // Issue our own JWT for API calls
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    const safe = user.toJSON();
    delete safe.password;

    res.json({
      token,
      user: safe,
      welcomeMessage: user.createdAt === user.updatedAt
        ? 'Welcome to Revilla — The way you love it! ✨'
        : `Welcome back, ${user.displayName}! ✨`,
    });
  } catch (err) {
    console.error('Supabase sync error:', err);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const safe = req.user.toJSON();
    delete safe.password;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
};

module.exports = { supabaseSync, getMe };
