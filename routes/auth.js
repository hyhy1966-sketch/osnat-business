const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { users } = require('../config/db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({ message: 'שם משתמש חייב להכיל לפחות 3 תווים' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'סיסמה חייבת להכיל לפחות 4 תווים' });
    }

    const existing = await users.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: 'שם המשתמש כבר תפוס' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await users.insert({ username, password: hashedPassword });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await users.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'שם משתמש או סיסמה שגויים' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'שם משתמש או סיסמה שגויים' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
