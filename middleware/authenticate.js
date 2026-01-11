// middleware/authenticate.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/User');

module.exports = async function (req, res, next) {
  try {
    // ✅ รองรับหลายแหล่ง token
    let token = null;

    // 1️⃣ จาก Authorization header (ของเดิม)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2️⃣ จาก cookie (ของใหม่)
    if (!token && req.cookies) {
      token = req.cookies.token || req.cookies.admin_token;
    }

    if (!token) {
      return res.status(401).json({ ok: false, message: 'ไม่พบ token' });
    }

    // ตรวจ token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded._id) {
      return res.status(401).json({ ok: false, message: 'token ไม่ถูกต้อง' });
    }

    // โหลด user จริงจาก DB (ของเดิมคุณทำถูกแล้ว)
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ ok: false, message: 'ผู้ใช้ไม่พบในระบบ' });
    }

    // แนบ user ให้ route อื่นใช้ต่อ
    req.user = user;
    next();

  } catch (err) {
    console.error('Auth verify failed:', err.message);
    return res.status(401).json({ ok: false, message: 'token ไม่ถูกต้อง' });
  }
};
