// models/Notification.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['system','info','deposit','withdraw','lottery','bonus'], // <-- เพิ่ม 'bonus'
    default: 'system'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: null },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Index helpful for dedupe queries and listing
NotificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
