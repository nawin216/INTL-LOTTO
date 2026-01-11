// Filename: models/SettlementSummary.js


const SettlementSummarySchema = new Schema({
roundId: { type: String, required: true, index: true },
totalTickets: { type: Number, default: 0 },
totalStaked: { type: Number, default: 0 }, // cents
totalPayout: { type: Number, default: 0 }, // cents
processedAt: { type: Date, default: Date.now },
processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
detail: { type: Schema.Types.Mixed }
});


module.exports = mongoose.model('SettlementSummary', SettlementSummarySchema);