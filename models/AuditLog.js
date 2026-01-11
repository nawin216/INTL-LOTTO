// Filename: models/AuditLog.js


const AuditLogSchema = new Schema({
actorId: { type: Schema.Types.ObjectId, ref: 'User' },
action: { type: String },
targetCollection: { type: String },
targetId: { type: Schema.Types.ObjectId },
detail: { type: Schema.Types.Mixed },
createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('AuditLog', AuditLogSchema);