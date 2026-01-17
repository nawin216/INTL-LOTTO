const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // ⏱ รอ server ไม่เกิน 10 วิ
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
    });

    isConnected = true;
    console.log('✅ MongoDB Connected');

    mongoose.connection.on('disconnected', () => {
      console.error('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB runtime error:', err.message);
    });

  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);

    // 🔁 retry อัตโนมัติ (สำคัญมากสำหรับ cron)
    setTimeout(() => {
      console.log('🔁 Retrying MongoDB connection...');
      connectDB();
    }, 5000);
  }
};

module.exports = connectDB;
