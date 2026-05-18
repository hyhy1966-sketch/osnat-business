const express = require('express');
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');
const { receipts } = require('../config/db');
const path = require('path');

const router = express.Router();

const BUSINESS = {
  name: 'אסנת הרציגר',
  subtitle: 'פסיכותרפיה זוגית ומשפחתית',
  type: 'עוסק פטור',
  taxId: '033205931',
  phone: '054-6685376',
  email: 'osnat.hertziger@gmail.com'
};

// Create receipt
router.post('/', auth, async (req, res) => {
  try {
    const { clientName, description, amount, date, method } = req.body;

    if (!clientName || !amount) {
      return res.status(400).json({ message: 'שם לקוח וסכום הם שדות חובה' });
    }

    const lastReceipt = await receipts.find({ userId: req.user.id }).sort({ number: -1 }).limit(1);
    const nextNumber = lastReceipt.length > 0 ? lastReceipt[0].number + 1 : 1;

    const receipt = await receipts.insert({
      userId: req.user.id,
      number: nextNumber,
      clientName,
      description: description || 'טיפול',
      amount: Number(amount),
      method: method || '',
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });

    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// Get all receipts
router.get('/', auth, async (req, res) => {
  try {
    const result = await receipts.find({ userId: req.user.id }).sort({ number: -1 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// Generate PDF for a receipt (token via query string for direct browser access)
router.get('/:id/pdf', (req, res, next) => {
  if (req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, auth, async (req, res) => {
  try {
    const receipt = await receipts.findOne({ _id: req.params.id, userId: req.user.id });
    if (!receipt) {
      return res.status(404).json({ message: 'קבלה לא נמצאה' });
    }

    const fontPath = path.join(__dirname, '..', 'public', 'fonts', 'NotoSansHebrew-Regular.ttf');
    const fontBoldPath = path.join(__dirname, '..', 'public', 'fonts', 'NotoSansHebrew-Bold.ttf');

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=receipt-${receipt.number}.pdf`);
    doc.pipe(res);

    doc.registerFont('Hebrew', fontPath);
    doc.registerFont('HebrewBold', fontBoldPath);

    // Helper for RTL text
    const rtl = (text) => text.split('').reverse().join('');

    // Border
    doc.rect(30, 30, 535, 780).stroke('#2c3e50');
    doc.rect(33, 33, 529, 774).stroke('#e0e0e0');

    // Header background
    doc.rect(33, 33, 529, 120).fill('#2c3e50');

    // Business name
    doc.font('HebrewBold').fontSize(26).fillColor('#ffffff');
    doc.text(BUSINESS.name, 50, 55, { align: 'right', width: 495, features: ['rtla'] });

    doc.font('Hebrew').fontSize(14).fillColor('#ecf0f1');
    doc.text(BUSINESS.subtitle, 50, 88, { align: 'right', width: 495, features: ['rtla'] });

    doc.font('Hebrew').fontSize(11).fillColor('#bdc3c7');
    doc.text('עוסק פטור', 50, 108, { width: 495, align: 'right', features: ['rtla'] });
    doc.text(BUSINESS.taxId, 50, 108, { width: 435, align: 'right' });

    doc.font('Hebrew').fontSize(10).fillColor('#95a5a6');
    doc.text('נייד:', 50, 121, { width: 495, align: 'right', features: ['rtla'] });
    doc.text(BUSINESS.phone, 50, 121, { width: 472, align: 'right' });

    doc.text('מייל:', 50, 134, { width: 495, align: 'right', features: ['rtla'] });
    doc.text(BUSINESS.email, 50, 134, { width: 470, align: 'right' });

    // Receipt title
    doc.font('HebrewBold').fontSize(22).fillColor('#2c3e50');
    doc.text('קבלה', 50, 170, { align: 'center', width: 495, features: ['rtla'] });

    // Receipt number and date - separate Hebrew labels from numbers
    doc.font('Hebrew').fontSize(12).fillColor('#555');
    doc.text('מספר קבלה:', 440, 205, { width: 105, align: 'right', features: ['rtla'] });
    doc.text(`${receipt.number}`, 390, 205, { width: 50, align: 'right' });

    const dateParts = receipt.date.split('-');
    const hebrewDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    doc.text('תאריך:', 440, 225, { width: 105, align: 'right', features: ['rtla'] });
    doc.text(hebrewDate, 355, 225, { width: 85, align: 'right' });

    // Divider
    doc.moveTo(50, 255).lineTo(545, 255).stroke('#2c3e50');

    // Client info
    doc.font('HebrewBold').fontSize(13).fillColor('#2c3e50');
    doc.text('פרטי לקוח:', 50, 275, { align: 'right', width: 495, features: ['rtla'] });
    doc.font('Hebrew').fontSize(12).fillColor('#333');
    doc.text('שם:', 440, 297, { width: 105, align: 'right', features: ['rtla'] });
    doc.text(receipt.clientName, 280, 297, { width: 160, align: 'right', features: ['rtla'] });

    // Service details
    doc.font('HebrewBold').fontSize(13).fillColor('#2c3e50');
    doc.text('פרטי השירות:', 50, 335, { align: 'right', width: 495, features: ['rtla'] });

    // Table header
    doc.rect(50, 360, 495, 30).fill('#ecf0f1');
    doc.font('HebrewBold').fontSize(11).fillColor('#2c3e50');
    doc.text('סכום', 60, 368, { width: 100, align: 'left', features: ['rtla'] });
    doc.text('אמצעי תשלום', 180, 368, { width: 120, align: 'center', features: ['rtla'] });
    doc.text('תיאור', 300, 368, { width: 245, align: 'right', features: ['rtla'] });

    // Table row
    const methodNames = {
      'bit': 'ביט',
      'paybox': 'פייבוקס',
      'credit': 'כרטיס אשראי',
      'transfer': 'העברה בנקאית',
      'cash': 'מזומן'
    };

    doc.rect(50, 390, 495, 30).fill('#ffffff').stroke('#e0e0e0');
    doc.font('Hebrew').fontSize(11).fillColor('#333');
    doc.text(`₪${receipt.amount.toLocaleString()}`, 60, 398, { width: 100, align: 'left' });
    doc.text(methodNames[receipt.method] || receipt.method || '-', 180, 398, { width: 120, align: 'center', features: ['rtla'] });
    doc.text(receipt.description, 300, 398, { width: 245, align: 'right', features: ['rtla'] });

    // Total
    doc.rect(50, 430, 495, 35).fill('#2c3e50');
    doc.font('HebrewBold').fontSize(14).fillColor('#ffffff');
    doc.text('סה"כ:', 300, 440, { width: 100, align: 'right', features: ['rtla'] });
    doc.text(`₪${receipt.amount.toLocaleString()}`, 150, 440, { width: 140, align: 'center' });

    // Note
    doc.font('Hebrew').fontSize(10).fillColor('#888');
    doc.text('עוסק פטור - פטור ממע"מ על פי חוק', 50, 480, { align: 'center', width: 495, features: ['rtla'] });

    // Footer
    doc.moveTo(50, 740).lineTo(545, 740).stroke('#e0e0e0');
    doc.font('Hebrew').fontSize(9).fillColor('#aaa');
    doc.text(`אסנת הרציגר - פסיכותרפיה זוגית ומשפחתית | עוסק פטור ${BUSINESS.taxId} | ${BUSINESS.phone} | ${BUSINESS.email}`, 50, 755, { align: 'center', width: 495, features: ['rtla'] });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאה ביצירת PDF' });
  }
});

module.exports = router;
