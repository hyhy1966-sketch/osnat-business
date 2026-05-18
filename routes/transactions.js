const express = require('express');
const auth = require('../middleware/auth');
const { transactions } = require('../config/db');

const router = express.Router();

// Add transaction (income or expense)
router.post('/', auth, async (req, res) => {
  try {
    const { type, amount, category, method, description, clientName, date } = req.body;

    if (!type || !amount || !method) {
      return res.status(400).json({ message: 'חסרים שדות חובה' });
    }

    const transaction = await transactions.insert({
      userId: req.user.id,
      type, // 'income' or 'expense'
      amount: Number(amount),
      category: category || '',
      method, // 'bit', 'paybox', 'credit', 'transfer', 'cash'
      description: description || '',
      clientName: clientName || '',
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// Get all transactions with optional filters
router.get('/', auth, async (req, res) => {
  try {
    const { type, month, year } = req.query;
    const query = { userId: req.user.id };

    if (type) query.type = type;

    let results = await transactions.find(query).sort({ date: -1 });

    if (month && year) {
      const prefix = `${year}-${month.padStart(2, '0')}`;
      results = results.filter(t => t.date.startsWith(prefix));
    } else if (year) {
      results = results.filter(t => t.date.startsWith(year));
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// Get summary (totals)
router.get('/summary', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const all = await transactions.find({ userId: req.user.id });

    let filtered = all;
    if (month && year) {
      const prefix = `${year}-${month.padStart(2, '0')}`;
      filtered = all.filter(t => t.date.startsWith(prefix));
    } else if (year) {
      filtered = all.filter(t => t.date.startsWith(year));
    }

    const totalIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const byMethod = {};
    filtered.forEach(t => {
      if (!byMethod[t.method]) byMethod[t.method] = { income: 0, expense: 0 };
      byMethod[t.method][t.type] += t.amount;
    });

    res.json({
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      count: filtered.length,
      byMethod
    });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const removed = await transactions.remove({ _id: req.params.id, userId: req.user.id });
    if (removed === 0) {
      return res.status(404).json({ message: 'לא נמצא' });
    }
    res.json({ message: 'נמחק בהצלחה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
