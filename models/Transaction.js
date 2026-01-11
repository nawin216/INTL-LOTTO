// models/Transaction.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const TransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // 'deposit','withdraw','lottery_purchase','lottery_win','admin_topup'
  amount: { type: Number, required: true }, // หน่วย = บาท (จำนวนเต็มหรือทศนิยม)
  balanceBefore: { type: Number, default: 0 }, // บาท
  balanceAfter: { type: Number, default: 0 },  // บาท
  refId: { type: Schema.Types.ObjectId, default: null }, // อ้างอิง เช่น ticket._id
  status: { type: String, enum: ['pending','success','failed'], default: 'success' },
  description: { type: String, default: '' },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
