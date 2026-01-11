// routes/lottery-admin-extra.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const PrizeRule = require('../models/PrizeRule');
const LotteryRound = require('../models/LotteryRound');
const PreGeneratedDraw = require('../models/PreGeneratedDraw');
const authenticate = require('../middleware/authenticate');

/**
 * requireAdmin: เหมือนไฟล์ก่อนหน้า
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
 * GET /api/lottery/admin/prize-rules
 * -> { ok:true, rules: [...] }
 */
router.get('/lottery/admin/prize-rules', authenticate, requireAdmin, async (req, res) => {
  try {
    const rules = await PrizeRule.find({}).lean();
    return res.json({ ok: true, rules });
  } catch (err) {
    console.error('prize-rules get error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * PUT /api/lottery/admin/prize-rules
 * body: { rules: [{digitCount, percent}] }
 * -> replace/update active rules
 */
router.put('/lottery/admin/prize-rules', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ ok: false, error: 'rules required' });

    // deactivate existing
    await PrizeRule.updateMany({}, { $set: { active: false } });

    const ops = rules.map(r => ({
      updateOne: {
        filter: { digitCount: r.digitCount },
        update: { $set: { digitCount: r.digitCount, percent: r.percent, active: true } },
        upsert: true
      }
    }));
    if (ops.length) await PrizeRule.bulkWrite(ops);

    const newRules = await PrizeRule.find({ active: true }).lean();
    return res.json({ ok: true, rules: newRules });
  } catch (err) {
    console.error('prize-rules put error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * GET /api/lottery/admin/rounds/:roundId/tickets
 * -> คืน tickets ของงวด พร้อม user { uid, email } embed
 */
router.get('/lottery/admin/rounds/:roundId/tickets', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roundId } = req.params;
    // limit to reasonable number to avoid huge payload
    const tickets = await Ticket.find({ roundId })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate({ path: 'userId', select: 'uid email' })
      .lean();

    const out = tickets.map(t => {
      const user = t.userId ? { _id: t.userId._id, uid: t.userId.uid, email: t.userId.email } : null;
      return { ...t, user };
    });

    return res.json({ ok: true, tickets: out });
  } catch (err) {
    console.error('round tickets error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/lottery/admin/pre-generated?date=YYYY-MM-DD
router.get(
  '/lottery/admin/pre-generated',
  authenticate,
  requireAdmin,
  async (req, res) => {
    const date = req.query.date;
    if (!date) {
      return res.json({ ok: false, error: 'date required' });
    }

    const draws = await PreGeneratedDraw.find({ date })
      .sort({ drawIndex: 1 })
      .lean();

    res.json({ ok: true, draws });
  }
);


module.exports = router;
