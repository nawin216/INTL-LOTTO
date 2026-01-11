// routes/notifications.js
const express = require('express');
const router = express.Router();
const { userSockets } = require("../socketStore");

const Notification = require('../models/Notification');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate'); // ใช้เหมือนเดิม

// middleware: เช็คสิทธิ์ admin
async function requireAdmin(req, res, next) {
  try {
    const uid = req.user?._id || req.user?.id;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = await User.findById(uid).lean();
    if (!user || user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// 1) ADMIN -> ส่งแจ้งเตือนให้ user (แบบ mount path admin/users/:userId/notifications)
router.post('/admin/users/:userId/notifications', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, message, type, link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ ok: false, message: 'กรุณาระบุหัวข้อและข้อความแจ้งเตือน' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: 'ไม่พบผู้ใช้เป้าหมาย' });

    // dedupe: ป้องกันการสร้างซ้ำภายใน short window (5s)
    const recentWindowMs = 5000;
    const cutoff = new Date(Date.now() - recentWindowMs);
    const existing = await Notification.findOne({
      user: user._id,
      title: String(title).trim(),
      message: String(message).trim(),
      createdBy: req.user?._id || null,
      createdAt: { $gte: cutoff }
    }).lean();

    if (existing) {
      console.warn('Deduped admin->user notification', { userId: user._id.toString(), title });
      return res.json({ ok: true, message: 'แจ้งเตือนถูกส่งไปแล้ว (dedupe)', notification: existing });
    }

    const notif = await Notification.create({
      user: user._id,
      title: String(title).trim(),
      message: String(message).trim(),
      type: type || 'system',
      link: link || null,
      isRead: false,
      createdBy: req.user?._id || null,
    });

    return res.json({ ok: true, message: 'ส่งแจ้งเตือนถึงผู้ใช้แล้ว', notification: notif });
  } catch (err) {
    console.error('Admin create notification error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// 2) USER ดึงรายการแจ้งเตือนของตัวเอง
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ ok: true, notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการโหลดแจ้งเตือน' });
  }
});

// 3) USER ดึงจำนวนที่ยังไม่อ่าน
router.get('/notifications/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Notification.countDocuments({ user: userId, isRead: false });
    return res.json({ ok: true, count });
  } catch (err) {
    console.error('Get unread-count error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการโหลดจำนวนแจ้งเตือน' });
  }
});

// 4) USER กดอ่านทั้งหมด
router.patch('/notifications/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    return res.json({ ok: true, message: 'อัปเดตแจ้งเตือนเป็นอ่านแล้วทั้งหมด' });
  } catch (err) {
    console.error('Read-all notifications error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการอัปเดตแจ้งเตือน' });
  }
});

// 5) USER อ่านทีละอัน
router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notif) return res.status(404).json({ ok: false, message: 'ไม่พบแจ้งเตือน' });
    return res.json({ ok: true, notification: notif });
  } catch (err) {
    console.error('Read notification error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการอัปเดตแจ้งเตือน' });
  }
});

// 6) ADMIN ส่งแจ้งเตือนแบบ custom (admin-send)
router.post('/notifications/admin-send', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId, type, title, message, link } = req.body;
    // --- validate & sanitize notification type ---
const ALLOWED_NOTIFICATION_TYPES = ['system','info','deposit','withdraw','lottery','bonus'];

let t = (type || 'system');
if (typeof t !== 'string') t = String(t);
t = t.trim().toLowerCase();

if (!ALLOWED_NOTIFICATION_TYPES.includes(t)) {
  console.warn('admin-send: invalid notification type, forcing system:', t);
  t = 'system';
}

    if (!userId || !title || !message) {
      return res.status(400).json({ ok: false, message: 'ต้องระบุ userId, title และ message' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: 'ไม่พบผู้ใช้เป้าหมาย' });

    // dedupe: ป้องกัน duplicate ภายใน 5 วินาที
    const recentWindowMs = 5000;
    const cutoff = new Date(Date.now() - recentWindowMs);
    const existing = await Notification.findOne({
      user: user._id,
      title: String(title).trim(),
      message: String(message).trim(),
      createdBy: req.user?._id || null,
      createdAt: { $gte: cutoff }
    }).lean();

    if (existing) {
      console.warn('Deduped admin-send notification', { userId: user._id.toString(), title });
      return res.json({ ok: true, message: 'แจ้งเตือนถูกส่งไปแล้ว (dedupe)', notification: existing });
    }

    const doc = await Notification.create({
      user: user._id,
      type: t,
      title: String(title).trim(),
      message: String(message).trim(),
      link: link || null,
      isRead: false,
      createdBy: req.user?._id || null,
    });

    if (req.io) {
    req.io.emit("notification:new");
    }

    return res.json({ ok: true, message: 'ส่งการแจ้งเตือนสำเร็จ', notification: doc });
  } catch (err) {
    console.error('admin-send notification error:', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดขณะส่งการแจ้งเตือน' });
  }
});

module.exports = router;
