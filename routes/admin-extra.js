// routes/admin-extra.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction');
const authenticate = require('../middleware/authenticate');

/**
 * requireAdmin: ตรวจ req.user -> ดึง User จาก DB -> เช็ค role==='admin'
 * (ใช้แบบง่าย ถ้าคุณมี requireAdmin เดิมให้ใช้ของคุณแทน)
 */
async function requireAdmin(req, res, next) {
  try {
    const uid = req.user && (req.user._id || req.user.id);
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const u = await User.findById(uid).lean();
    if (!u || u.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

/**
 * GET /api/admin/user-lookup?query=...
 * - query: uid หรือ email หรือ ObjectId
 * - returns: { ok:true, user, tickets }
 */
router.get('/admin/user-lookup', authenticate, requireAdmin, async (req, res) => {
  try {
    const q = (req.query.query || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'query required' });

    let user = null;
    if (mongoose.Types.ObjectId.isValid(q)) {
      user = await User.findById(q).lean();
    }
    if (!user) user = await User.findOne({ uid: q }).lean();
    if (!user) user = await User.findOne({ email: q.toLowerCase() }).lean();

    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const tickets = await Ticket.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean();

    return res.json({ ok: true, user, tickets });
  } catch (err) {
    console.error('user-lookup error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * POST /api/wallet/admin/add-balance
 * Body: { userId, amount }
 * - Transactional: เพิ่ม balance + สร้าง Transaction (type: admin_topup)
 * - returns: { ok:true, newBalance }
 */
router.post('/wallet/admin/add-balance', authenticate, requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { userId, amount } = req.body;
    const amt = Number(amount);
    if (!userId || isNaN(amt) || amt <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ ok: false, error: 'invalid input' });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const before = (user.wallet && user.wallet.balance) || 0;
    const after = before + amt;

    user.wallet = user.wallet || {};
    user.wallet.balance = after;
    user.wallet.totalDeposits = (user.wallet.totalDeposits || 0) + amt;
    await user.save({ session });

    const tx = new Transaction({
      userId: user._id,
      type: 'admin_topup',
      amount: amt,
      balanceBefore: before,
      balanceAfter: after,
      meta: { note: 'admin topup' }
    });
    await tx.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ ok: true, newBalance: after });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('add-balance error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
