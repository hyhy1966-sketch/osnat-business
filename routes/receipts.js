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
    const { clientName, description, amount, date, method, serviceDate } = req.body;

    if (!clientName || !amount) {
      return res.status(400).json({ message: 'שם לקוח וסכום הם שדות חובה' });
    }

    const lastReceipt = await receipts.find({ userId: req.user.id }).sort({ number: -1 }).limit(1);
    const nextNumber = lastReceipt.length > 0 ? lastReceipt[0].number + 1 : 1;

    const receipt = await receipts.insert({
      userId: req.user.id,
      number: nextNumber,
      clientName,
      description: description || 'ייעוץ',
      serviceDate: serviceDate || date || new Date().toISOString().split('T')[0],
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
    const logoPath = path.join(__dirname, '..', 'public', 'fonts', 'logo.jpg');

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
    doc.rect(33, 33, 529, 130).fill('#2c3e50');

    // All header lines aligned to right edge (x=545) with equal 18px spacing
    const hx = 545;
    const hy = 46;
    const hLineGap = 18;

    // Line 1: Business name
    doc.font('HebrewBold').fontSize(22).fillColor('#ffffff');
    const nameW = doc.widthOfString(BUSINESS.name, { features: ['rtla'] });
    doc.text(BUSINESS.name, hx - nameW, hy, { features: ['rtla'] });

    // Line 2: Subtitle
    doc.font('Hebrew').fontSize(13).fillColor('#ffffff');
    const subW = doc.widthOfString(BUSINESS.subtitle, { features: ['rtla'] });
    doc.text(BUSINESS.subtitle, hx - subW, hy + hLineGap * 1.6, { features: ['rtla'] });

    // Line 3: Osek patur + number
    doc.font('Hebrew').fontSize(11).fillColor('#e0e0e0');
    const osekW = doc.widthOfString('עוסק פטור', { features: ['rtla'] });
    const taxW = doc.widthOfString(BUSINESS.taxId);
    doc.text('עוסק פטור', hx - osekW, hy + hLineGap * 3, { features: ['rtla'] });
    doc.text(BUSINESS.taxId, hx - osekW - taxW - 6, hy + hLineGap * 3);

    // Line 4: Phone
    doc.font('Hebrew').fontSize(10).fillColor('#e0e0e0');
    const naidW = doc.widthOfString('נייד:', { features: ['rtla'] });
    const phoneW = doc.widthOfString(BUSINESS.phone);
    doc.text('נייד:', hx - naidW, hy + hLineGap * 4, { features: ['rtla'] });
    doc.text(BUSINESS.phone, hx - naidW - phoneW - 6, hy + hLineGap * 4);

    // Line 5: Email
    const mailW = doc.widthOfString('מייל:', { features: ['rtla'] });
    const emailW = doc.widthOfString(BUSINESS.email);
    doc.text('מייל:', hx - mailW, hy + hLineGap * 5, { features: ['rtla'] });
    doc.text(BUSINESS.email, hx - mailW - emailW - 6, hy + hLineGap * 5);

    // Logo on left side of header
    try { doc.image(logoPath, 45, 42, { width: 100 }); } catch(e) {}

    // Receipt title
    doc.font('HebrewBold').fontSize(22).fillColor('#2c3e50');
    doc.text('קבלה', 50, 180, { align: 'center', width: 495, features: ['rtla'] });

    // Receipt number and date
    doc.font('Hebrew').fontSize(12).fillColor('#222');
    const miskW = doc.widthOfString('מספר קבלה:', { features: ['rtla'] });
    doc.text('מספר קבלה:', 50, 215, { width: 495, align: 'right', features: ['rtla'] });
    doc.text(`${receipt.number}`, 545 - miskW - doc.widthOfString(`${receipt.number}`) - 6, 215);

    const dateParts = receipt.date.split('-');
    const hebrewDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const taarichW = doc.widthOfString('תאריך:', { features: ['rtla'] });
    doc.text('תאריך:', 50, 235, { width: 495, align: 'right', features: ['rtla'] });
    doc.text(hebrewDate, 545 - taarichW - doc.widthOfString(hebrewDate) - 6, 235);

    // Divider
    doc.moveTo(50, 265).lineTo(545, 265).stroke('#2c3e50');

    // Client info
    doc.font('HebrewBold').fontSize(13).fillColor('#2c3e50');
    doc.text('פרטי לקוח:', 50, 285, { align: 'right', width: 495, features: ['rtla'] });
    doc.font('Hebrew').fontSize(12).fillColor('#111');
    const shemW = doc.widthOfString('שם:', { features: ['rtla'] });
    doc.text('שם:', 50, 307, { width: 495, align: 'right', features: ['rtla'] });
    doc.text(receipt.clientName, 545 - shemW - doc.widthOfString(receipt.clientName, { features: ['rtla'] }) - 6, 307, { features: ['rtla'] });

    // Service details
    doc.font('HebrewBold').fontSize(13).fillColor('#2c3e50');
    doc.text('פרטי השירות:', 50, 345, { align: 'right', width: 495, features: ['rtla'] });

    // Table header
    doc.rect(50, 370, 495, 30).fill('#ecf0f1');
    doc.font('HebrewBold').fontSize(11).fillColor('#2c3e50');
    doc.text('סכום', 60, 378, { width: 80, align: 'left', features: ['rtla'] });
    doc.text('אמצעי תשלום', 150, 378, { width: 100, align: 'center', features: ['rtla'] });
    doc.text('תאריך שירות', 260, 378, { width: 100, align: 'center', features: ['rtla'] });
    doc.text('תיאור', 370, 378, { width: 175, align: 'right', features: ['rtla'] });

    // Table row
    const methodNames = {
      'bit': 'ביט',
      'paybox': 'פייבוקס',
      'credit': 'כרטיס אשראי',
      'transfer': 'העברה בנקאית',
      'cash': 'מזומן'
    };

    const sd = receipt.serviceDate ? receipt.serviceDate.split('-') : null;
    const serviceDateStr = sd ? `${sd[2]}/${sd[1]}/${sd[0]}` : '-';

    doc.rect(50, 400, 495, 30).fill('#ffffff').stroke('#e0e0e0');
    doc.font('Hebrew').fontSize(11).fillColor('#111');
    doc.text(`₪${receipt.amount.toLocaleString()}`, 60, 408, { width: 80, align: 'left' });
    doc.text(methodNames[receipt.method] || receipt.method || '-', 150, 408, { width: 100, align: 'center', features: ['rtla'] });
    doc.text(serviceDateStr, 260, 408, { width: 100, align: 'center' });
    doc.text(receipt.description, 370, 408, { width: 175, align: 'right', features: ['rtla'] });

    // Total
    doc.rect(50, 440, 495, 35).fill('#2c3e50');
    doc.font('HebrewBold').fontSize(14).fillColor('#ffffff');
    doc.text('סה"כ:', 300, 450, { width: 100, align: 'right', features: ['rtla'] });
    doc.text(`₪${receipt.amount.toLocaleString()}`, 150, 450, { width: 140, align: 'center' });

    // Note
    doc.font('Hebrew').fontSize(10).fillColor('#444');
    doc.text('עוסק פטור - פטור ממע"מ על פי חוק', 50, 495, { align: 'center', width: 495, features: ['rtla'] });

    // Footer
    doc.moveTo(50, 730).lineTo(545, 730).stroke('#999');
    doc.font('Hebrew').fontSize(9).fillColor('#555');
    doc.text('אסנת הרציגר - פסיכותרפיה זוגית ומשפחתית', 50, 740, { align: 'center', width: 495, features: ['rtla'] });
    doc.font('Hebrew').fontSize(9).fillColor('#555');
    const fOsekW = doc.widthOfString('עוסק פטור', { features: ['rtla'] });
    const fTaxW = doc.widthOfString(BUSINESS.taxId);
    const fNaidW2 = doc.widthOfString('נייד:', { features: ['rtla'] });
    const fPhoneW = doc.widthOfString(BUSINESS.phone);
    const fMailW2 = doc.widthOfString('מייל:', { features: ['rtla'] });
    const fEmailW = doc.widthOfString(BUSINESS.email);
    const gap = 4;
    const sep = 14;

    const totalW = fOsekW + gap + fTaxW + sep + fNaidW2 + gap + fPhoneW + sep + fMailW2 + gap + fEmailW;
    let fx = (545 + 50 - totalW) / 2 + totalW;

    doc.text('עוסק פטור', fx - fOsekW, 753, { features: ['rtla'] });
    fx -= fOsekW + gap;
    doc.text(BUSINESS.taxId, fx - fTaxW, 753);
    fx -= fTaxW + sep;
    doc.text('נייד:', fx - fNaidW2, 753, { features: ['rtla'] });
    fx -= fNaidW2 + gap;
    doc.text(BUSINESS.phone, fx - fPhoneW, 753);
    fx -= fPhoneW + sep;
    doc.text('מייל:', fx - fMailW2, 753, { features: ['rtla'] });
    fx -= fMailW2 + gap;
    doc.text(BUSINESS.email, fx - fEmailW, 753);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאה ביצירת PDF' });
  }
});

module.exports = router;
