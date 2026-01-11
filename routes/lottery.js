// routes/lottery.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const LotteryRound = require('../models/LotteryRound');
const Transaction = require('../models/Transaction');
const PrizeRule = require('../models/PrizeRule');
const Notification = require('../models/Notification');

const authenticate = require('../middleware/authenticate');
//const { settleRoundInternal } = require('../_legacy/services/settleRoundInternal');

// ---------- utils ----------
function genTicketId() {
  return (
    'T' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

function getUserId(req) {
  if (req.user && req.user._id) return req.user._id;
  if (req.user && req.user.id) return req.user.id;
  return null;
}

async function requireAdmin(req, res, next) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ ok: false });

  const user = await User.findById(userId).lean();
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin only' });
  }
  next();
}

// ---------- GET rounds ----------
router.get('/rounds', async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;

  const rounds = await LotteryRound.find(q)
    .sort({ drawAt: 1 })
    
    .lean();

  res.json({ ok: true, rounds });
});

router.get('/rounds/:roundId', async (req, res) => {
  const round = await LotteryRound.findOne({
    roundId: req.params.roundId,
  }).lean();

  if (!round) {
    return res.status(404).json({ ok: false, error: 'Round not found' });
  }

  res.json({ ok: true, round });
});

// ---------- BUY TICKET ----------
router.post('/rounds/:roundId/tickets', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserId(req);
    const { entries } = req.body;
    const roundId = req.params.roundId;

    const round = await LotteryRound.findOne({ roundId }).session(session);
    if (!round || round.status !== 'open') {
      throw new Error('ROUND_CLOSED');
    }

    const user = await User.findById(userId).session(session);
    let totalStake = 0;
    const ticketEntries = [];

    const prizeRules = await PrizeRule.find({ active: true }).lean();
    const prizeMap = {};
    prizeRules.forEach(p => prizeMap[p.digitCount] = p);

    for (const e of entries) {
      const base = prizeMap[e.digitCount];
      let percent = base?.percent ?? 100;

      if (Array.isArray(user.payoutOverrides)) {
        const ov = user.payoutOverrides.find(o => o.digitCount === e.digitCount);
        if (ov) percent = ov.percent;
      }

      const payout = Math.floor(e.stake * (100 + percent) / 100);

      totalStake += e.stake;
      ticketEntries.push({
        ...e,
        appliedPercent: percent,
        potentialPayout: payout,
      });
    }

    if (user.wallet.balance < totalStake) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const ticket = await Ticket.create([{
      ticketId: genTicketId(),
      userId,
      roundId,
      entries: ticketEntries,
      totalStake,
      status: 'pending',
    }], { session });

    user.wallet.balance -= totalStake;
    await user.save({ session });

    await Transaction.create([{
      userId,
      type: 'lottery_purchase',
      amount: totalStake,
      balanceAfter: user.wallet.balance,
      meta: { roundId }
    }], { session });

    await session.commitTransaction();

/* =========================
   🔔 1) บันทึก Notification ลง MongoDB
========================= */
await Notification.create({
  user: userId,                 // <-- ตรงกับ models/Notification.js
  type: "lottery",
  title: "🎟 ซื้อหวยสำเร็จ",
  message: `คุณซื้อหวยงวด ${roundId} จำนวน ${totalStake} บาท`,
  link: `/lottery/bill/${ticket[0].ticketId}`,
  isRead: false,
});

/* =========================
   📡 2) ส่ง Real-time ให้ client
========================= */
// (ถ้าคุณมีระบบ join room ตาม userId ใน socket แล้ว แนะนำแบบนี้)
if (req.io) {
  req.io.emit("lottery:ticketCreated", ticket[0]);
  req.io.emit("notification:new", { userId }); // 🔴 ใช้กระตุ้นจุดแดง
}

res.json({ ok: true, ticket: ticket[0] });


  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ ok: false, error: err.message });
  } finally {
    session.endSession();
  }
});


router.get('/history', async (req, res) => {
  const limit = Number(req.query.limit) || 24; // ⬅️ รับจาก frontend

  const rounds = await LotteryRound.find({
    status: { $in: ['drawn', 'settled'] },
  })
    .sort({ drawAt: -1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: rounds,
  });
});




module.exports = router;
