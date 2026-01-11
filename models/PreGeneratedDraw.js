// models/PreGeneratedDraw.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PreGeneratedDrawSchema = new Schema({
  date: {
    type: String,
    required: true,
    index: true // yyyy-mm-dd (Asia/Bangkok)
  },

  drawIndex: {
    type: Number,
    required: true // 1..12 (วันละ 12 งวด)
  },

  roundId: {
    type: String,
    required: true,
    unique: true // เช่น 2025-01-20-01
  },

  number8: {
    type: String,
    required: true // '20092351'
  },

  status: {
    type: String,
    enum: ['unused', 'assigned'],
    default: 'unused'
  },

  seedHash: {
    type: String // เผื่อ audit ภายหลัง
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ❗ ห้ามซ้ำงวดในวันเดียวกัน
PreGeneratedDrawSchema.index(
  { date: 1, drawIndex: 1 },
  { unique: true }
);

// ❗ เลข 8 หลัก ห้ามซ้ำในวันเดียวกัน
PreGeneratedDrawSchema.index(
  { date: 1, number8: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'PreGeneratedDraw',
  PreGeneratedDrawSchema
);
