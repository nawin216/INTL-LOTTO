// routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ✅ ถอยขึ้นไปโฟลเดอร์บนให้ถูก
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction');
const authenticate = require('../middleware/authenticate');
const PrizeRule = require('../models/PrizeRule');
const isAdmin = require('../middleware/isAdmin');


router.use(authenticate, isAdmin);

// ดึง userId จาก req.user ให้ชัวร์
function getUserId(req) {
  if (req.user && req.user._id) return req.user._id;
  if (req.user && req.user.id) return req.user.id;
  return null;
}

// ✅ เช็คว่าเป็น admin จริงไหม
async function requireAdmin(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ ok: false, error: 'User not found' });
    }

    // รองรับทั้ง role และ isAdmin (กันกรณี token เก่า)
    const isAdminRole = user.role === 'admin';
    const isAdminFlag = req.user && (req.user.isAdmin === true || req.user.role === 'admin');

    if (!isAdminRole && !isAdminFlag) {
      return res.status(403).json({ ok: false, error: 'Admin only' });
    }

    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

/* =========================
 *   GET /api/admin/users
 *   ดึงรายชื่อผู้ใช้ทั้งหมด
 * ========================= */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .select('_id uid email wallet depositEnabled withdrawEnabled createdAt')
      .lean();

    return res.json({ ok: true, users });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==========================================
 *   PATCH /api/admin/users/:id/balance
 *   แก้ยอดเงินคงเหลือของ user (เซ็ตตรง ๆ)
 *   body: { balance: Number }  หน่วย = บาท
 * ========================================== */
router.patch('/users/:id/balance', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { balance } = req.body;

    balance = Number(balance);
    if (isNaN(balance) || balance < 0) {
      return res.status(400).json({ ok: false, error: 'Invalid balance' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    user.wallet = user.wallet || {};
    user.wallet.balance = balance;
    await user.save();

    return res.json({
      ok: true,
      userId: user._id,
      newBalance: user.wallet.balance,
    });
  } catch (err) {
    console.error('PATCH /api/admin/users/:id/balance error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==========================================
 *   PATCH /api/admin/users/:id/flags
 *   เปิด/ปิด สิทธิ์ฝาก-ถอน
 *   body: { depositEnabled, withdrawEnabled }
 * ========================================== */
router.patch('/users/:id/flags', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { depositEnabled, withdrawEnabled } = req.body;

    // แปลง string "true"/"false" ให้เป็น boolean เผื่อมาจาก form
    if (typeof depositEnabled === 'string') {
      depositEnabled = depositEnabled === 'true';
    }
    if (typeof withdrawEnabled === 'string') {
      withdrawEnabled = withdrawEnabled === 'true';
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    if (typeof depositEnabled === 'boolean') {
      user.depositEnabled = depositEnabled;
    }
    if (typeof withdrawEnabled === 'boolean') {
      user.withdrawEnabled = withdrawEnabled;
    }

    await user.save();

    return res.json({
      ok: true,
      userId: user._id,
      depositEnabled: user.depositEnabled,
      withdrawEnabled: user.withdrawEnabled,
    });
  } catch (err) {
    console.error('PATCH /api/admin/users/:id/flags error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==================================================
 *   GET /api/admin/users/:id/transactions
 *   ประวัติธุรกรรม: ฝาก / ถอน / lottery_purchase / lottery_win
 * ================================================== */
router.get('/users/:id/transactions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const txs = await Transaction.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ ok: true, transactions: txs });
  } catch (err) {
    console.error('GET /api/admin/users/:id/transactions error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==========================================
 *   GET /api/admin/users/:id/tickets
 *   บิลหวยของผู้ใช้
 * ========================================== */
router.get('/users/:id/tickets', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tickets = await Ticket.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ ok: true, tickets });
  } catch (err) {
    console.error('GET /api/admin/users/:id/tickets error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==========================================
 *   GET /api/admin/users/:id/payouts
 *   อ่าน % จ่ายหวยของผู้ใช้ + ค่า default จาก PrizeRule
 * ========================================== */
router.get('/users/:id/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // ดึง PrizeRule ที่ active
    const prizeRules = await PrizeRule.find({ active: true }).lean();
    const defaultPercents = {};
    prizeRules.forEach(r => {
      if (r.digitCount != null && r.percent != null) {
        defaultPercents[String(r.digitCount)] = r.percent;
      }
    });

    const overrides = {};
    (user.payoutOverrides || []).forEach(o => {
      if (o.digitCount != null && o.percent != null) {
        overrides[String(o.digitCount)] = o.percent;
      }
    });

    return res.json({
      ok: true,
      defaultPercents,
      overrides,
    });
  } catch (err) {
    console.error('GET /api/admin/users/:id/payouts error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==========================================
 *   GET /api/admin/users/:id/payouts
 *   อ่าน % จ่ายหวยของผู้ใช้ + ค่า default จาก PrizeRule
 *   RETURNS unified percents object for frontend: { p2, p3, p4, p8 }
 * ========================================== */
router.get('/users/:id/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // ดึง PrizeRule ที่ active
    const prizeRules = await PrizeRule.find({ active: true }).lean();
    const defaultPercents = {};
    prizeRules.forEach(r => {
      if (r.digitCount != null && r.percent != null) {
        // map to p{digit} naming for frontend compatibility (p2, p3, p4, p8)
        defaultPercents[`p${String(r.digitCount)}`] = r.percent;
      }
    });

    // read overrides from user (user.payoutOverrides expected array of { digitCount, percent, prizeRuleId })
    const overridesMap = {};
    (user.payoutOverrides || []).forEach(o => {
      if (o.digitCount != null && o.percent != null) {
        overridesMap[`p${String(o.digitCount)}`] = o.percent;
      }
    });

    // build unified percents: overrides take precedence over default
    const unified = {};
    ['p2','p3','p4','p8'].forEach(k => {
      if (overridesMap[k] != null) unified[k] = overridesMap[k];
      else if (defaultPercents[k] != null) unified[k] = defaultPercents[k];
      else unified[k] = null;
    });

    return res.json({
      ok: true,
      percents: unified,
      defaults: defaultPercents,
      overrides: overridesMap,
    });
  } catch (err) {
    console.error('GET /api/admin/users/:id/payouts error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ==========================================
 *   PATCH /api/admin/users/:id/payouts
 *   ตั้ง % จ่ายหวยรายผู้ใช้
 *   Accepts flexible payloads:
 *     { percents: { p2: 70, p3: 500, p4: 900, p8: 1000 } }
 *     OR
 *     { percents: { "2": 70, "3": 500, "4": 900, "8": 1000 } }
 *   - If value is null/''/undefined -> remove override for that digit (use default)
 * ========================================== */
router.patch('/users/:id/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { percents } = req.body; // expected object

    if (!percents || typeof percents !== 'object') {
      return res.status(400).json({ ok: false, error: 'percents is required' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // get active prize rules to validate prizeRuleId later
    const prizeRules = await PrizeRule.find({ active: true }).lean();
    const prizeMap = {};
    prizeRules.forEach(r => { prizeMap[String(r.digitCount)] = r; });

    // normalize percents keys to digitCount strings '2','3','4','8'
    const normalized = {};
    Object.keys(percents).forEach(k => {
      let digit = null;
      if (k.startsWith('p') && k.length === 2 && /\d/.test(k[1])) {
        digit = k[1]; // 'p2' -> '2'
      } else if (/^\d+$/.test(k)) {
        digit = k;
      }
      if (digit) normalized[String(digit)] = percents[k];
    });

    const newOverrides = [];

    ['2','3','4','8'].forEach(dcStr => {
      if (!(dcStr in normalized)) return; // not provided -> ignore
      let val = normalized[dcStr];

      if (val === '' || val === null || typeof val === 'undefined') {
        // means remove override for this digit -> do nothing (skip adding)
        return;
      }

      val = Number(val);
      if (isNaN(val) || val < 0) {
        // invalid -> skip silently (or collect errors if you prefer)
        return;
      }

      const rule = prizeMap[dcStr];
      if (!rule) return;

      newOverrides.push({
        prizeRuleId: rule._id,
        digitCount: Number(dcStr),
        percent: val,
      });
    });

    // Save overrides to user document
    user.payoutOverrides = newOverrides;
    await user.save();

    return res.json({ ok: true, overrides: newOverrides });
  } catch (err) {
    console.error('PATCH /api/admin/users/:id/payouts error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

router.get('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id uid email wallet depositEnabled withdrawEnabled createdAt payoutOverrides')
      .lean();

    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});


module.exports = router;
