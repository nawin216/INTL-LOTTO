// routes/profile.js

const express = require("express");
const router = express.Router();

const User = require("../models/User");
const authenticate = require("../middleware/authenticate");

// helper: แปลงสตางค์ -> บาท
function fromCents(cents) {
  return (Number(cents) || 0) / 100;
}

// ============================
// ✅ ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
// GET /api/profile
// ============================
router.get("/", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" });
    }

    const wallet = user.wallet || {
      balance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
    };

    return res.json({
      email: user.email,
      uid: user.uid,
      name: user.name || "",
      phone: user.phone || "",
      role: user.role || "user",

      // ข้อมูลกระเป๋า (แสดงเป็นบาท)
      wallet: {
        balance: fromCents(wallet.balance),
        totalDeposits: fromCents(wallet.totalDeposits),
        totalWithdrawals: fromCents(wallet.totalWithdrawals),
      },

      // KYC ถูกตัดออกจากระบบแล้ว
      kycStatus: "none",
    });
  } catch (err) {
    console.error("GET /api/profile ERROR:", err);
    return res
      .status(500)
      .json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์" });
  }
});

module.exports = router;
