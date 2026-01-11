// routes/withdrawRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const { sendTelegramAlert } = require('../utils/telegram');

// ทุก endpoint ต้องล็อกอินก่อน
router.use(authenticate);

/**
 * POST /api/withdrawals
 * สร้างคำขอถอนเงิน (สถานะ = pending)
 */
router.post('/', async (req, res) => {
  try {
    const { amount, network, walletAddress } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ ok: false, message: 'จำนวนเงินถอนต้องมากกว่า 0' });
    }
    if (!network || !walletAddress) {
      return res.status(400).json({ ok: false, message: 'กรุณาระบุเครือข่ายและที่อยู่กระเป๋า' });
    }

    const user = await User.findById(req.user._id);
const balance = user?.wallet?.balance || 0;

if (numAmount > balance) {
  return res.status(400).json({ ok: false, message: 'ยอดเงินไม่เพียงพอ' });
}

// 🔴 1) หักเงินทันที
user.wallet.balance -= numAmount;
await user.save();

// 🔴 2) บันทึกคำขอถอน
const withdrawal = await Withdrawal.create({
  userId: req.user._id,
  amount: numAmount,
  network,
  walletAddress,
  status: 'pending',
});

// 🔴 3) แจ้ง client แบบ real-time ว่ายอดเงินเปลี่ยน
if (req.io) {
  req.io.to(req.user._id.toString()).emit("wallet:update", {
    balance: user.wallet.balance,
    delta: -numAmount,
    type: "withdraw_request"
  });
}

    // 🔔 แจ้ง Telegram เมื่อมีคำขอถอนเงินใหม่
    try {
      const uid = user?.uid || req.user._id;
      const email = user?.email || "-";

      await sendTelegramAlert(
        "💸 คำขอถอนเงินใหม่\n" +
        `UID: ${uid}\n` +
        `Email: ${email}\n` +
        `จำนวนเงิน: ${numAmount} USDT\n` +
        `เครือข่าย: ${network}\n` +
        `Wallet: ${walletAddress}`
      );
    } catch (e) {
      console.error("Telegram withdraw alert error:", e.message);
    }

    return res.json({
      ok: true,
      message: 'ส่งคำขอถอนเงินเรียบร้อย กรุณารอแอดมินตรวจสอบ',
      withdrawal,
    });

  } catch (err) {
    console.error('Create withdrawal error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

/**
 * GET /api/withdrawals/my
 * ดูประวัติถอนของตัวเอง
 */
router.get('/my', async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (err) {
    console.error('Get my withdrawals error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

module.exports = router;
