// models/Withdrawal.js
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
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
  network: {
    type: String,
    required: true, // เช่น TRON/TRC20, BSC, ETH ฯลฯ
  },
  walletAddress: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  adminNote: String,
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin', // ถ้าไม่มี model Admin จริง ๆ จะปล่อย null ก็ได้
  },
}, {
  timestamps: true, // createdAt, updatedAt
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);