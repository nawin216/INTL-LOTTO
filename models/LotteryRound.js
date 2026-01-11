const mongoose = require('mongoose');

const LotteryRoundSchema = new mongoose.Schema({
  date: String,
  roundNo: Number,
  roundId: { type: String, index: true },
  result8: String,
  drawAt: Date,

  status: {
    type: String,
    enum: ['pending', 'open', 'closing', 'drawn', 'settled'],
    default: 'pending'
  },

  // 🛡 safeguard fields
  settling: { type: Boolean, default: false },
  settlingAt: { type: Date },
  settledAt: { type: Date },

}, { timestamps: true });

module.exports = mongoose.model('LotteryRound', LotteryRoundSchema);
