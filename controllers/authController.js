const easyLogin = async (req, res) => {
  try {
    const { displayName, email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ where: { email: cleanEmail } });

    if (!user) {
      // New user — create account
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
        password: require('crypto').randomBytes(32).toString('hex'),
        referralCode: require('crypto').randomBytes(4).toString('hex').toUpperCase(),
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