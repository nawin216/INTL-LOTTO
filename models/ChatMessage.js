// models/ChatMessage.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ChatMessageSchema = new Schema({
  roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  senderType: { type: String, enum: ['user', 'admin'], required: true },
  text: { type: String },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ChatMessage
  || mongoose.model('ChatMessage', ChatMessageSchema);
