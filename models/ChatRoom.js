// models/ChatRoom.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ChatRoomSchema = new Schema({
  // ผู้ใช้ 1 คน = 1 ห้อง
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  lastMessage: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

// export ให้เป็น Mongoose model จริง ๆ
module.exports =
  mongoose.models.ChatRoom || mongoose.model('ChatRoom', ChatRoomSchema);
