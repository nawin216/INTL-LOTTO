// routes/transactions.js

const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const authenticate = require("../middleware/authenticate");

/**
 * GET /api/transactions/wallet/balance
 */
router.get("/wallet/balance", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) {
      return res.status(404).json({ ok: false, message: "ไม่พบผู้ใช้" });
    }

    const wallet = user.wallet || {
      balance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
    };

    return res.json({
      ok: true,
      balance: Number(wallet.balance || 0),
      totalDeposits: Number(wallet.totalDeposits || 0),
      totalWithdrawals: Number(wallet.totalWithdrawals || 0),
    });
  } catch (err) {
    console.error("GET /wallet/balance ERROR:", err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
});

/**
 * GET /api/transactions/user-history
 */
router.get("/user-history", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const txDocs = await Transaction.find({
      userId,
      type: { $in: ["lottery_purchase", "lottery_win", "admin_topup"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const depositDocs = await Deposit.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const withdrawDocs = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const history = [];

    txDocs.forEach((tx) => {
      history.push({
        type: tx.type,
        amount: Number(tx.amount || 0),
        status: tx.status || "success",
        createdAt: tx.createdAt,
      });
    });

    depositDocs.forEach((d) => {
      history.push({
        type: "deposit",
        amount: Number(d.amount || 0),
        status: d.status || "pending",
        createdAt: d.createdAt,
      });
    });

    withdrawDocs.forEach((w) => {
      history.push({
        type: "withdraw",
        amount: Number(w.amount || 0),
        status: w.status || "pending",
        createdAt: w.createdAt,
      });
    });

    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ ok: true, transactions: history });
  } catch (err) {
    console.error("GET /api/transactions/user-history ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลธุรกรรม",
    });
  }
});

module.exports = router;
