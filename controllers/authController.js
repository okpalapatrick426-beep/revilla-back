const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const register = async (req, res) => {
  try {
    let { username, email, password, displayName, referralCode } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'Username, email and password are required' });

    email = email.toLowerCase().trim();
    username = username.toLowerCase().trim();

    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(400).json({ error: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ where: { referralCode } });
      if (referrer) referredBy = referrer.id;
    }

    const user = await User.create({
      username, email, password: hashed,
      displayName: displayName || username,
      referredBy,
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'revilla2026', { expiresIn: '30d' });
    const safe = user.toJSON();
    delete safe.password;
    res.status(201).json({ token, user: safe, welcomeMessage: 'Revilla — The way you love it' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
};

const login = async (req, res) => {
  try {
    let { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password)
      return res.status(400).json({ error: 'Email/username and password are required' });

    emailOrUsername = emailOrUsername.toLowerCase().trim();

    const user = await User.findOne({
      where: emailOrUsername.includes('@') ? { email: emailOrUsername } : { username: emailOrUsername }
    });

    if (!user) return res.status(401).json({ error: 'No account found with that email or username' });
    if (user.isBanned) return res.status(403).json({ error: 'Your account has been suspended' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    await user.update({ isOnline: true, lastSeen: new Date() });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'revilla2026', { expiresIn: '30d' });
    const safe = user.toJSON();
    delete safe.password;
    res.json({
      token, user: safe,
      welcomeMessage: `Welcome back, ${user.displayName || user.username}! Revilla — The way you love it`
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const safe = req.user.toJSON();
    delete safe.password;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
};

module.exports = { register, login, getMe };
