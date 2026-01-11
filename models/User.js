// models/User.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * เก็บเงินเป็น "บาท" ตรง ๆ (ไม่ใช้สตางค์แล้ว)
 * เช่น 100 บาท => 100
 */

const PayoutOverrideSchema = new Schema(
  {
    // ประเภทเลขท้าย 2 / 3 / 4 / 8 ตัว
    digitCount: {
      type: Number,
      enum: [2, 3, 4, 8],
      required: true,
    },
    // % การจ่ายของ user คนนี้ สำหรับ digitCount นี้
    // เช่น 95 = จ่าย 95% ของกติกาปกติ, หรือจะใช้ 400 = จ่าย 4 เท่าก็ได้
    percent: {
      type: Number,
      min: 0,
      max: 10000, // กันเผื่ออนาคต
      required: true,
    },
  },
  { _id: false }
);

const UserSchema = new Schema({
  uid: {
    type: String,
    unique: true,
    index: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  passwordHash: {
    type: String,
    required: true,
  },

  name: {
    type: String,
    default: "",
  },

  phone: {
    type: String,
    default: "",
  },

  // สิทธิ์
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  // เปิด/ปิดสิทธิ์ฝาก–ถอน สำหรับแอดมินไว้ควบคุม
  depositEnabled: { type: Boolean, default: true },
  withdrawEnabled: { type: Boolean, default: true },

  // ======================
  // ✅ WALLET (หน่วย = บาท)
  // ======================
  wallet: {
    balance: { type: Number, default: 0 }, // ยอดคงเหลือปัจจุบัน (บาท)
    totalDeposits: { type: Number, default: 0 }, // ยอดฝากสะสม (บาท)
    totalWithdrawals: { type: Number, default: 0 }, // ยอดถอนสะสม (บาท)
  },

  // ======================
  // ✅ % การจ่ายหวยรายผู้ใช้
  //     - ถ้าไม่มี หรือไม่มี digitCount ที่ตรง → ใช้กติกากลางจาก PrizeRule
  // ======================
  payoutOverrides: [PayoutOverrideSchema],

  // ======================
  // ✅ ข้อมูลหวยของ user (สำรองอ้างอิง)
  // ======================
  lotteryTickets: [
    {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
    },
  ],

  // ======================
  // ✅ Timestamp
  // ======================
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// อัปเดต updatedAt ทุกครั้งก่อน save
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("User", UserSchema);
