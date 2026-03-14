const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const generateToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '30d' }
);

const register = async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const existingUsername = await User.findOne({ where: { username: username.toLowerCase().trim() } });
    if (existingUsername) return res.status(400).json({ error: 'Username taken' });

    const hashed = await bcrypt.hash(password, 10);
    const referralCode = uuidv4().split('-')[0].toUpperCase();

    let referredBy = null;
    if (req.body.referralCode) {
      referredBy = await User.findOne({ where: { referralCode: req.body.referralCode } });
    }

    const user = await User.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      displayName: displayName || username,
      referralCode,
    });

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
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
};

const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }

    const identifier = emailOrUsername.toLowerCase().trim();
    const user = await User.findOne({
      where: identifier.includes('@') ? { email: identifier } : { username: identifier }
    });

    if (!user) return res.status(401).json({ error: 'No account found with that email or username' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended', reason: user.banReason });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password — please try again' });

    await user.update({ isOnline: true, lastSeen: new Date() });
    const token = generateToken(user);
    const safe = user.toJSON();
    delete safe.password;
    res.json({ token, user: safe });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
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
