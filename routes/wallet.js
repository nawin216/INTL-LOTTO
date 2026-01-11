// routes/wallet.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Withdrawal = require("../models/Withdrawal");
const authenticate = require("../middleware/authenticate");

/**
 * Simple admin check middleware (uses mongoose document in req.user)
 */
async function requireAdmin(req, res, next) {
  try {
    const uid = req.user?._id || req.user?.id;
    if (!uid) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const user = await User.findById(uid).lean();
    if (!user || user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin only" });
    }

    next();
  } catch (err) {
    console.error("requireAdmin", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
}

/**
 * GET /api/wallet
 * - คืน wallet ทั้งก้อนของ user (ใช้ในที่อื่นอยู่แล้ว)
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const uid = req.user?._id || req.user?.id;
    if (!uid) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const user = await User.findById(uid).lean();
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({
      ok: true,
      wallet:
        user.wallet || {
          balance: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
        },
    });
  } catch (err) {
    console.error("GET /api/wallet error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * ✅ NEW: GET /api/wallet/info
 * ใช้สำหรับหน้า personal-info.html
 */
router.get("/info", authenticate, async (req, res) => {
  try {
    const uid = req.user?._id || req.user?.id;
    if (!uid) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const user = await User.findById(uid).lean();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // ข้อมูลกระเป๋าจาก User.wallet (หน่วย = บาท)
    const wallet = user.wallet || {
      balance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
    };

    const balance = Number(wallet.balance || 0);
    const totalDeposits = Number(wallet.totalDeposits || 0);

    // คำนวณยอดถอน 24 ชม. ล่าสุดจาก Withdrawal (เฉพาะ status = approved)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const agg = await Withdrawal.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(uid),
          status: "approved",
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalWithdrawals24h = agg.length > 0 ? agg[0].total : 0;

    // ตามเงื่อนไขคุณ: ถอนสูงสุด 24 ชม. = "ยอดฝากทั้งหมด"
    const availableToWithdraw24h = totalDeposits;

    return res.json({
      ok: true,
      balance,
      totalDeposits,
      totalWithdrawals24h,
      availableToWithdraw24h,
    });
  } catch (err) {
    console.error("GET /api/wallet/info ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
});

/**
 * POST /api/wallet/admin/add-balance
 * - Admin endpoint to add balance to a user (atomic)
 * Body: { userId: '<mongoId>', amount: Number }
 * Response: { ok:true, newBalance: Number }
 */
router.post(
  "/admin/add-balance",
  authenticate,
  requireAdmin,
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { userId } = req.body;
      let amount = req.body.amount;
      amount = typeof amount === "string" ? parseFloat(amount) : amount;
      amount = Number(amount);

      if (!userId || isNaN(amount) || amount <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ ok: false, message: "invalid payload" });
      }

      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ ok: false, message: "user not found" });
      }

      user.wallet = user.wallet || {};
      const before = user.wallet.balance || 0;
      const after = before + amount;
      user.wallet.balance = after;
      user.wallet.totalDeposits =
        (user.wallet.totalDeposits || 0) + amount;
      await user.save({ session });

      const tx = new Transaction({
        userId: user._id,
        type: "admin_topup",
        amount,
        balanceBefore: before,
        balanceAfter: after,
        description: "Admin top-up",
      });
      await tx.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.json({ ok: true, newBalance: after });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("admin add-balance", err);
      return res
        .status(500)
        .json({ ok: false, message: "Server error" });
    }
  }
);

module.exports = router;
