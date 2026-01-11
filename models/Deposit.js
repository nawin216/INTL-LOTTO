// models/Deposit.js
const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  slipUrl: {
    type: String, // เก็บ path หรือ URL ของรูปสลิป
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  adminNote: {
    type: String,
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true, // createdAt, updatedAt
});

module.exports = mongoose.model('Deposit', depositSchema);
