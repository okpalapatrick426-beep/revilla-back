const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'revilla2026';

const generateToken = (user) => jwt.sign(
  { id: user.id },
  JWT_SECRET,
  { expiresIn: '30d' }
);

const register = async (req, res) => {
  try {
    const { username, email, password, displayName, referralCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(400).json({ error: 'Username taken' });
    const hashed = await bcrypt.hash(password, 12);
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ where: { referralCode } });
      if (referrer) referredBy = referrer.id;
    }
    const user = await User.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      displayName: displayName || username,
      referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      referredBy,
      isVerified: true,
    });
    const token = generateToken(user);
    const safe = user.toJSON();
    delete safe.password;
    res.status(201).json({ token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
};

const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({
      where: emailOrUsername.includes('@')
        ? { email: emailOrUsername.toLowerCase().trim() }
        : { username: emailOrUsername.toLowerCase().trim() }
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    await user.update({ isOnline: true, lastSeen: new Date() });
    const token = generateToken(user);
    const safe = user.toJSON();
    delete safe.password;
    res.json({ token, user: safe });
  } catch (err) {
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
  try {
    const safe = req.user.toJSON();
    delete safe.password;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
};

const easyLogin = async (req, res) => {
  try {
    const { displayName, email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ where: { email: cleanEmail } });
    if (!user) {
      const baseUsername = (displayName || cleanEmail.split('@')[0])
        .toLowerCase().replace(/[^a-z0-9]/gi, '').substring(0, 15);
      let username = baseUsername;
      let attempt = 0;
      while (await User.findOne({ where: { username } })) {
        username = `${baseUsername}${Math.floor(Math.random() * 9999)}`;
        if (attempt++ > 10) break;
      }
      user = await User.create({
        email: cleanEmail,
        username,
        displayName: displayName || username,
        password: crypto.randomBytes(32).toString('hex'),
        referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
        isVerified: true,
      });
    } else {
      await user.update({ isOnline: true, lastSeen: new Date() });
    }
    const token = generateToken(user);
    const safe = user.toJSON();
    delete safe.password;
    res.json({ token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
};

module.exports = { register, login, logout, getMe, easyLogin };