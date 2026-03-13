const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const generateToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const register = async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(400).json({ error: 'Username taken' });

    const hashed = await bcrypt.hash(password, 12);
    const referralCode = uuidv4().split('-')[0].toUpperCase();

    // Check if referred
    let referredBy = null;
    if (req.body.referralCode) {
      referredBy = await User.findOne({ where: { referralCode: req.body.referralCode } });
    }

    const user = await User.create({
      username, email, password: hashed,
      displayName: displayName || username,
      referralCode,
    });

    // Process referral
    if (referredBy) {
      const { Referral } = require('../models');
      await Referral.create({
        referrerId: referredBy.id, referredId: user.id,
        code: req.body.referralCode, status: 'completed',
        pointsAwarded: 50, completedAt: new Date(),
      });
      await referredBy.increment('referralPoints', { by: 50 });
    }

    const token = generateToken(user);
    const safe = user.toJSON();
    delete safe.password;
    res.status(201).json({ token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    const user = await User.findOne({
      where: emailOrUsername.includes('@')
        ? { email: emailOrUsername }
        : { username: emailOrUsername }
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended', reason: user.banReason });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await user.update({ isOnline: true, lastSeen: new Date() });
    const token = generateToken(user);
    const safe = user.toJSON();
    delete safe.password;
    res.json({ token, user: safe });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};

const logout = async (req, res) => {
  try {
    await req.user.update({ isOnline: false, lastSeen: new Date() });
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

const getMe = async (req, res) => {
  const safe = req.user.toJSON();
  delete safe.password;
  res.json(safe);
};

module.exports = { register, login, logout, getMe };
