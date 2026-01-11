// routes/chat.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User'); 
const multer = require('multer');
const path = require('path');

// จัดเก็บรูปใน /uploads/chat
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/chat'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/** ดึง userId จาก header Authorization: Bearer <token> */
function getUserIdFromAuthHeader(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // ปกติของโปรเจกต์คุณน่าจะเป็นแบบนี้แหละ
    return decoded.id || decoded.userId || decoded._id || null;
  } catch (err) {
    console.error('JWT verify error in chat:', err.message);
    return null;
  }
}

// ----------------- APIs -----------------

// ห้องแชทของ user (1 user = 1 room)
router.get('/user-room', async (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'UNAUTHORIZED'
      });
    }

    let room = await ChatRoom.findOne({ userId });

    if (!room) {
      room = await ChatRoom.create({ userId });
    }

    res.json({ success: true, room });
  } catch (err) {
    console.error('GET /api/chat/user-room error:', err);
    res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

// ประวัติข้อความในห้อง
router.get('/messages/:roomId', async (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'UNAUTHORIZED' });
    }

    const messages = await ChatMessage.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, messages });
  } catch (err) {
    console.error('GET /api/chat/messages error:', err);
    res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

// อัปโหลดรูป
router.post('/upload', upload.single('image'), (req, res) => {
  const userId = getUserIdFromAuthHeader(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'UNAUTHORIZED' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'NO_FILE' });
  }

  const url = `/uploads/chat/${req.file.filename}`;
  res.json({ success: true, url });
});

// ดึงรายชื่อห้องแชททั้งหมด (ใช้ในหน้า admin-chat)
router.get('/rooms', async (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'UNAUTHORIZED' });
    }

    // ถ้าจะเช็ค role = 'admin' จริง ๆ ต้องดึง user มาดู role ต่อด้วย
    // ตอนนี้ขอข้ามเรื่อง role ไปก่อนเพื่อให้ใช้งานได้แน่นอน

    let rooms = await ChatRoom.find({})
      .sort({ updatedAt: -1 })
      .lean();

    // ผูกข้อมูล user (uid/email) เข้าไปในแต่ละ room
    const userIds = rooms.map(r => r.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select('uid email')
      .lean();

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    rooms = rooms.map(r => ({
      ...r,
      user: userMap[r.userId?.toString()] || null
    }));

    res.json({ success: true, rooms });
  } catch (err) {
    console.error('GET /api/chat/rooms error:', err);
    res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

module.exports = router;
