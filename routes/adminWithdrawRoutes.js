// routes/adminWithdrawRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// ให้ต้องมี token ก่อน (ถ้ามี isAdmin แล้วจะเอามาใช้เพิ่มภายหลังก็ได้)
router.use(authenticate);

/**
 * GET /api/admin/withdrawals?status=pending&userId=...
 * ดึงคำขอถอน (กรองตาม user / status ได้)
 */
router.get('/', async (req, res) => {
  try {
    const { status, userId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const withdrawals = await Withdrawal.find(filter)
      .populate('userId', 'email uid')
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    console.error('Admin get withdrawals error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

/**
 * PATCH /api/admin/withdrawals/:id/confirm
 * body: { action: 'approve' | 'reject', adminNote? }
 */
router.patch('/:id/confirm', async (req, res) => {
  try {
    const { action, adminNote } = req.body;
    const withdrawalId = req.params.id;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ message: 'ไม่พบคำขอถอนเงิน' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'คำขอนี้ถูกดำเนินการไปแล้ว' });
    }

    const adminId = (req.user && req.user._id) || null;

    if (action === 'approve') {
      // ตรวจยอดล่าสุดก่อนตัด (กันกรณีเงินถูกใช้ไปแล้ว)
      const user = await User.findById(withdrawal.userId);
      if (!user) {
        return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
      }

      const balance = user.wallet?.balance || 0;
      if (withdrawal.amount > balance) {
        return res.status(400).json({ message: 'ยอดเงินไม่เพียงพอสำหรับอนุมัติถอน' });
      }

      // อัปเดตคำขอ
      withdrawal.status = 'approved';
      withdrawal.adminNote = adminNote || '';
      withdrawal.approvedAt = new Date();
      withdrawal.approvedBy = adminId;
      await withdrawal.save();

      // หักยอดในกระเป๋า + เพิ่มยอดถอนสะสม
      const updatedUser = await User.findByIdAndUpdate(
        withdrawal.userId,
        {
          $inc: {
            'wallet.balance': -withdrawal.amount,
            'wallet.totalWithdrawals': withdrawal.amount,
          },
        },
        { new: true }
      );

      return res.json({
        message: 'อนุมัติการถอนเงินเรียบร้อย และตัดยอดในกระเป๋าแล้ว',
        withdrawal,
        user: updatedUser,
      });
    }

    if (action === 'reject') {
      withdrawal.status = 'rejected';
      withdrawal.adminNote = adminNote || '';
      await withdrawal.save();

      return res.json({
        message: 'ปฏิเสธคำขอถอนเงินแล้ว',
        withdrawal,
      });
    }

    return res.status(400).json({ message: 'action ไม่ถูกต้อง' });
  } catch (err) {
    console.error('Admin confirm withdrawal error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

module.exports = router;
