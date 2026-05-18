const express = require('express');
const auth = require('../middleware/auth');
const { clients } = require('../config/db');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name) return res.status(400).json({ message: 'שם לקוח חובה' });

    const client = await clients.insert({
      userId: req.user.id,
      name,
      phone: phone || '',
      email: email || '',
      createdAt: new Date().toISOString()
    });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const result = await clients.find({ userId: req.user.id }).sort({ name: 1 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await clients.remove({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'נמחק בהצלחה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
