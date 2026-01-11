// routes/withdraw.js

const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Withdraw = require("../models/Withdraw");
const authenticate = require("../middleware/authenticate");

// Helper แปลงสตางค์ -> บาท
function fromCents(cents) {
  return (Number(cents) || 0) / 100;
}

// ============================
// ✅ ผู้ใช้: ดูคำขอถอนของตัวเอง
// GET /api/withdraw/my
// ============================
router.get("/my", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const requests = await Withdraw.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const mapped = requests.map((w) => ({
      _id: w._id,
      amount: fromCents(w.amount),
      walletAddress: w.walletAddress,
      network: w.network,
      status: w.status,
      createdAt: w.createdAt,
      processedAt: w.processedAt || null,
    }));

    return res.json({ requests: mapped });
  } catch (err) {
    console.error("GET /withdraw/my ERROR:", err);
    return res
      .status(500)
      .json({ message: "เกิดข้อผิดพลาดในการดึงรายการถอนเงิน" });
  }
});

// ============================
// ✅ แอดมิน: ดูคำขอถอนทั้งหมด
// GET /api/withdraw/admin/all
// ============================
router.get("/admin/all", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "คุณไม่มีสิทธิ์เข้าถึง" });
    }

    const requests = await Withdraw.find({})
      .populate("userId", "email uid")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = requests.map((w) => ({
      _id: w._id,
      userId: w.userId?._id,
      email: w.userId?.email,
      uid: w.userId?.uid,
      amount: fromCents(w.amount),
      walletAddress: w.walletAddress,
      network: w.network,
      status: w.status,
      createdAt: w.createdAt,
      processedAt: w.processedAt || null,
    }));

    return res.json({ requests: mapped });
  } catch (err) {
    console.error("GET /withdraw/admin/all ERROR:", err);
    return res
      .status(500)
      .json({ message: "เกิดข้อผิดพลาดในการดึงรายการถอนเงิน (admin)" });
  }
});

// ============================
// ✅ แอดมิน: เปลี่ยนสถานะคำขอถอน
// PUT /api/withdraw/admin/update-status/:id
// body: { status: "approved" | "rejected" | "processed" }
// ============================
router.put("/admin/update-status/:id", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "คุณไม่มีสิทธิ์เข้าถึง" });
    }

    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["pending", "approved", "rejected", "processed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
    }

    const withdrawReq = await Withdraw.findById(id);
    if (!withdrawReq) {
      return res.status(404).json({ message: "ไม่พบคำขอถอนเงิน" });
    }

    const prevStatus = withdrawReq.status;
withdrawReq.status = status;

// 🔴 ถ้าแอดมิน "ปฏิเสธ" → คืนเงิน
if (status === "rejected" && prevStatus !== "rejected") {
  const user = await User.findById(withdrawReq.userId);
  user.wallet.balance += withdrawReq.amount;
  await user.save();

  // 🔔 real-time คืนเงิน
  if (req.io) {
    req.io.to(user._id.toString()).emit("wallet:update", {
      balance: user.wallet.balance,
      delta: withdrawReq.amount,
      type: "withdraw_rejected"
    });
  }
}

// 🟢 ถ้าอนุมัติ/processed → ไม่ต้องหักซ้ำ
if (status === "processed") {
  withdrawReq.processedAt = new Date();
  withdrawReq.processedBy = req.user._id;
}

await withdrawReq.save();

    return res.json({
      message: "อัปเดตสถานะคำขอถอนเงินสำเร็จ",
      request: {
        _id: withdrawReq._id,
        status: withdrawReq.status,
        processedAt: withdrawReq.processedAt,
      },
    });
  } catch (err) {
    console.error("PUT /withdraw/admin/update-status/:id ERROR:", err);
    return res
      .status(500)
      .json({ message: "เกิดข้อผิดพลาดในการอัปเดตสถานะคำขอถอนเงิน" });
  }
});

module.exports = router;
