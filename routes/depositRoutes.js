// routes/depositRoutes.js
const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const Deposit = require('../models/Deposit');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const { sendTelegramAlert } = require('../utils/telegram');

// ---------- ตั้งค่า multer สำหรับอัปโหลดรูปสลิป ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // โฟลเดอร์เก็บรูปสลิป (ต้องมีโฟลเดอร์นี้จริงในโปรเจกต์)
    cb(null, 'uploads/slips');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ทุก endpoint ในไฟล์นี้ต้องล็อกอินก่อน
router.use(authenticate);

/**
 * POST /api/deposits
 * form-data: { amount, slip (file) }
 * ผู้ใช้ส่งคำขอฝากเงิน (status = pending)
 */
router.post('/', upload.single('slip'), async (req, res) => {
  try {
    const { amount } = req.body;
    const file = req.file;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'จำนวนเงินฝากต้องมากกว่า 0' });
    }

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'กรุณาอัปโหลดสลิปการโอนเงิน' });
    }

    const slipUrl = `/uploads/slips/${file.filename}`;
    const userId = req.user._id;

    const deposit = await Deposit.create({
      userId,
      amount: numAmount,
      slipUrl,
      status: 'pending',
    });

    // 🔔 แจ้งเตือน Telegram เมื่อมีคำขอฝากเงินใหม่
    try {
      const user = await User.findById(userId).select('uid email').lean();
      const uid = user?.uid || userId;
      const email = user?.email || '-';

      await sendTelegramAlert(
        `💰 คำขอฝากเงินใหม่\n` +
        `UID: ${uid}\n` +
        `Email: ${email}\n` +
        `ยอด: ${numAmount.toLocaleString('th-TH')} USDT`
      );
    } catch (err) {
      console.error('telegram deposit notify error:', err.message);
    }

    return res.json({
      success: true,
      message: 'ส่งคำขอฝากเงินเรียบร้อย กรุณารอแอดมินตรวจสอบ',
      deposit,
    });
  } catch (err) {
    console.error('Create deposit error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/deposits/my
 * ดูประวัติฝากเงินของตัวเอง
 */
router.get('/my', async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json(deposits);
  } catch (err) {
    console.error('Get my deposits error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

module.exports = router;
