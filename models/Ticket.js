// models/Ticket.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const TicketEntrySchema = new Schema({
  digitCount: { type: Number, required: true },   // 2/3/4/8
  numbers: { type: String, required: true },      // e.g. '12','345'
  stake: { type: Number, required: true },        // บาท (เงินที่ผู้เล่นแทง)
  appliedPercent: { type: Number, required: true }, // เช่น 200 = กำไร 200% ของทุน
  potentialPayout: { 
    type: Number, 
    required: true 
    // บาท (ยอดที่จะจ่าย "รวมทุน+กำไร" เช่น stake=100, percent=200 => potentialPayout=300)
  }
}, { _id: false });

const TicketSchema = new Schema({
  ticketId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  roundId: { type: String, required: true, index: true },
  entries: { type: [TicketEntrySchema], default: [] },
  totalStake: { type: Number, required: true }, // บาท (รวมเงินที่แทงในบิลนี้)
  totalPayout: { type: Number, default: 0 },     // บาท (ยอดจ่ายจริงเมื่อ settle แล้ว)
  status: { type: String, enum: ['pending','won','lost'], default: 'pending' },
  settledAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);
