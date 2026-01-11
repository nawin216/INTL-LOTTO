// models/PrizeRule.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PrizeRuleSchema = new Schema({
  name: { type: String },
  digitCount: { type: Number, required: true }, // 2..8
  percent: { type: Number, required: true }, // e.g. 120 -> 120%
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.PrizeRule
  || mongoose.model('PrizeRule', PrizeRuleSchema);
