// routes/adminLottery.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const PreGeneratedDraw = require('../models/PreGeneratedDraw');
const LotteryRound = require('../models/LotteryRound');
const Ticket = require('../models/Ticket');
const SettlementSummary = require('../models/SettlementSummary');
const Transaction = require('../models/Transaction');
const PrizeRule = require('../models/PrizeRule');

const authenticate = require('../middleware/authenticate');
const isAdmin = require('../middleware/isAdmin'); // ensure req.user is admin

// helper to generate daily pregen draws for a date
// options: { date: 'YYYY-MM-DD', count: 288, intervalMinutes: 5 }
router.post('/pregen', authenticate, isAdmin, async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const count = Number(req.body.count) || 288;

    const existing = await PreGeneratedDraw.find({ date }).countDocuments();
    if (existing > 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'PreGenerated draws already exist for date' });
    }

    const docs = [];
    for (let i = 1; i <= count; i++) {
      // random 8-digit string
      const num = Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, '0');
      docs.push({
        date,
        drawIndex: i,
        roundId: String(Date.now()).slice(-6) + '-' + i,
        number8: num,
        status: 'unused',
        createdAt: new Date(),
      });
    }

    await PreGeneratedDraw.insertMany(docs);
    res.json({ ok: true, created: docs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * GET /admin/pregen?date=YYYY-MM-DD
 */
router.get('/pregen', authenticate, isAdmin, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const draws = await PreGeneratedDraw.find({ date })
      .sort({ drawIndex: 1 })
      .lean();
    res.json({ ok: true, draws });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// 🔐 ADMIN: view rounds status
router.get(
  '/engine/rounds',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const LotteryRound = require('../models/LotteryRound');

      const rounds = await LotteryRound.find()
        .sort({ drawAt: -1 })
        .limit(50)
        .lean();

      res.json({ ok: true, rounds });
    } catch (err) {
      console.error('[ADMIN][ENGINE][ROUNDS]', err);
      res.status(500).json({
        ok: false,
        error: 'Failed to load rounds',
      });
    }
  }
);



/**
 * POST /admin/rounds/:roundId/draw
 * ดึงเลขจาก PreGeneratedDraw -> set result8 -> เคลียร์บิล
 * กติกา: ใช้เลขท้ายของ result8 เฉพาะ 2 / 3 / 4 ตัว เท่านั้น

router.post('/rounds/:roundId/draw', authenticate, isAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const round = await LotteryRound.findOne({
      roundId: req.params.roundId,
    }).session(session);

    if (!round) {
      await session.abortTransaction();
      return res.status(404).json({ ok: false, error: 'Round not found' });
    }

    if (round.status !== 'open') {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ ok: false, error: 'Round not open' });
    }

    // หา pre-generated draw ที่ผูกกับ round นี้
    const pre = await PreGeneratedDraw.findOne({
      roundId: round.roundId,
    }).session(session);

    if (!pre) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ ok: false, error: 'PreGenerated draw not found' });
    }

    // เซ็ตผล 8 หลักของงวดนี้
    round.result8 = pre.number8; // string ยาว 8 หลัก
    round.status = 'drawn';
    await round.save({ session });

    // เคลียร์บิล: match เลขท้ายเฉพาะ 2 / 3 / 4 ตัว
    const tickets = await Ticket.find({
      roundId: round.roundId,
      status: 'pending',
    }).session(session);

    let totalTickets = tickets.length;
    let totalStaked = 0;
    let totalPayout = 0;

    for (const t of tickets) {
      let payoutForTicket = 0;

      for (const entry of t.entries) {
        totalStaked += entry.stake; // ยังเก็บเป็นหน่วยเดียวกับที่ซื้อ (เช่น satang)

        const k = entry.digitCount;

        // ✅ ใช้เฉพาะเลข 2 / 3 / 4 ตัวท้ายเท่านั้น
        if (![2, 3, 4].includes(k)) {
          continue; // ถ้า digitCount ไม่ใช่ 2/3/4 ข้ามไปเลย
        }

        const lastK = round.result8.slice(-k);
        if (lastK === entry.numbers) {
          // stake * percent (เช่น 100 = 1 เท่า, 120 = 1.2 เท่า)
          payoutForTicket += Math.floor(
            (entry.stake * entry.appliedPercent) / 100
          );
        }
      }

      if (payoutForTicket > 0) {
        // credit ให้ user
        const userId = t.userId;
        const User = mongoose.model('User');
        const user = await User.findById(userId).session(session);

        const balanceBefore =
          user.wallet && user.wallet.balance ? user.wallet.balance : 0;
        const balanceAfter = balanceBefore + payoutForTicket;

        user.wallet = user.wallet || {};
        user.wallet.balance = balanceAfter;
        await user.save({ session });

        const tx = new Transaction({
          userId,
          type: 'lottery_payout',
          amount: payoutForTicket,
          balanceBefore,
          balanceAfter,
          refId: t._id,
          meta: { roundId: round.roundId },
        });
        await tx.save({ session });

        totalPayout += payoutForTicket;
        t.status = 'won';
        t.settledAt = new Date();
      } else {
        t.status = 'lost';
        t.settledAt = new Date();
      }

      await t.save({ session });
    }

    // summary ของงวดนี้
    const summary = new SettlementSummary({
      roundId: round.roundId,
      totalTickets,
      totalStaked,
      totalPayout,
      processedAt: new Date(),
      processedBy: req.user._id,
    });
    await summary.save({ session });

    round.status = 'settled';
    round.settledAt = new Date();
    await round.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ ok: true, totalTickets, totalStaked, totalPayout, result8: round.result8 });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});*/

/**
 * GET /admin/rounds/:roundId/report
 */
router.get('/rounds/:roundId/report', authenticate, isAdmin, async (req, res) => {
  try {
    const summary = await SettlementSummary.findOne({
      roundId: req.params.roundId,
    }).lean();

    if (!summary) {
      return res
        .status(404)
        .json({ ok: false, error: 'No settlement summary' });
    }

    res.json({ ok: true, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
