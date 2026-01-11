// routes/adminDepositRoutes.js
const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const User = require('../models/User');

// ใช้ middleware เดียวกับฝั่ง admin ส่วนอื่น
const authenticate = require('../middleware/authenticate');  // <- ของเดิมใช้กับ user อยู่แล้ว
// ถ้ามี isAdmin และ token ของ admin มี flag isAdmin จริง ค่อยใช้เพิ่มได้ภายหลัง
// const isAdmin = require('../middleware/isAdmin');

// ให้ทุก endpoint ในนี่ต้องผ่าน authenticate ก่อน
router.use(authenticate);
// ถ้าต้องการบังคับเฉพาะ admin จริง ๆ (และตั้ง token ไว้แล้ว) ให้เปิดบรรทัดด้านล่างนี้เพิ่ม
// router.use(isAdmin);

// GET /api/admin/deposits?status=pending&userId=xxxx
router.get('/', async (req, res) => {
  try {
    const { status, userId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const deposits = await Deposit.find(filter)
      .populate('userId', 'email username uid')
      .sort({ createdAt: -1 });

    res.json(deposits);
  } catch (err) {
    console.error('Admin get deposits error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

// PATCH /api/admin/deposits/:id/confirm
// body: { action: 'approve' | 'reject', adminNote?: string }
router.patch('/:id/confirm', async (req, res) => {
  try {
    const { action, adminNote } = req.body;
    const depositId = req.params.id;

    const deposit = await Deposit.findById(depositId);
    if (!deposit) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลคำขอฝากเงิน' });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({ message: 'คำขอนี้ถูกดำเนินการไปแล้ว' });
    }

    // ถ้าคุณมีระบบ admin จริง ๆ สามารถอ่านจาก req.user ได้
    const adminId = (req.user && req.user._id) || null;

    if (action === 'approve') {
      deposit.status = 'approved';
      deposit.adminNote = adminNote || '';
      deposit.approvedAt = new Date();
      deposit.approvedBy = adminId;
      await deposit.save();

      // *** สำคัญ: เปลี่ยนชื่อ field walletBalance ให้ตรงกับ User model คุณ ***
      const user = await User.findByIdAndUpdate(
  deposit.userId,
  {
    $inc: {
      'wallet.balance': deposit.amount,        // ยอดคงเหลือในกระเป๋า
      'wallet.totalDeposits': deposit.amount,  // ยอดฝากสะสม (ถ้ามีใช้ในระบบ)
    },
  },
  { new: true }
);


      if (!user) {
        return res.status(500).json({ message: 'ไม่พบผู้ใช้เพื่ออัปเดตยอดเงิน แต่คำขอฝากถูกอนุมัติแล้ว' });
      }

      return res.json({
        message: 'อนุมัติการฝากเงินเรียบร้อย และอัปเดตยอดในกระเป๋าแล้ว',
        deposit,
        user,
      });
    }

    if (action === 'reject') {
      deposit.status = 'rejected';
      deposit.adminNote = adminNote || '';
      await deposit.save();

      return res.json({
        message: 'ปฏิเสธคำขอฝากเงินแล้ว',
        deposit,
      });
    }

    return res.status(400).json({ message: 'action ไม่ถูกต้อง' });
  } catch (err) {
    console.error('Admin confirm deposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

module.exports = router;
