//routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const authenticate = require("../middleware/authenticate");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// ==================
// ✅ REGISTER
// ==================
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "กรุณากรอก email และ password" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "อีเมลนี้ถูกใช้แล้ว" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      passwordHash: hashedPassword,
      name: name || "",
      uid: "UID" + Date.now(),
      role: "user",
      wallet: {
        balance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0
      }
    });

    await newUser.save();

    const token = jwt.sign(
      {
        _id: newUser._id,
        email: newUser.email,
        role: newUser.role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      token
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการสมัครสมาชิก" });
  }
});

// ==================
// ✅ LOGIN
// ==================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "ไม่พบผู้ใช้นี้" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
  res.cookie('admin_token', token, {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
   });
    res.json({
  message: "เข้าสู่ระบบสำเร็จ",
  token,
  role: user.role   // ✅ เพิ่มบรรทัดนี้
});

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
});

// ==================
// ✅ PROFILE
// ==================
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" });
    }

    res.json({
      email: user.email,
      uid: user.uid,
      name: user.name,
      role: user.role,
      wallet: user.wallet
    });

  } catch (error) {
    console.error("PROFILE ERROR:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์" });
  }
});

// ==================
// ✅ ADMIN: UPDATE USER WALLET
// ==================
router.put("/admin/update-wallet/:userId", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "คุณไม่มีสิทธิ์เข้าถึง" });
    }

    const { userId } = req.params;
    const { balance, totalDeposits, totalWithdrawals } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    if (balance !== undefined) user.wallet.balance = balance;
    if (totalDeposits !== undefined) user.wallet.totalDeposits = totalDeposits;
    if (totalWithdrawals !== undefined) user.wallet.totalWithdrawals = totalWithdrawals;

    await user.save();

    res.json({
      message: "อัปเดตข้อมูลกระเป๋าเรียบร้อยแล้ว",
      wallet: user.wallet
    });

  } catch (error) {
    console.error("UPDATE WALLET ERROR:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ✅ รีเซ็ตรหัสผ่านแบบง่าย (กรอก email + รหัสใหม่)
router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    if (!email || !newPassword) {
      return res.status(400).json({ message: "กรุณากรอกอีเมลและรหัสผ่านใหม่" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "ไม่พบอีเมลนี้ในระบบ" });
    }

    // แฮชรหัสใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashedPassword;

    await user.save();

    res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จแล้ว ✅" });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});


module.exports = router;
