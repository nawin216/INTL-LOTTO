// worker.js (FINAL – PRODUCTION)

require('dotenv').config();
const connectDB = require('./config/db');

const {
  updateRoundStatuses,
  settleDueRounds,
  catchUpPreGenerateDailyNumbers,
  catchUpCreateDailyRounds,
  catchUpSettleRounds,
} = require('./lotteryEngine');

let running = false;

async function boot() {
  await connectDB();
  console.log('🟢 Worker connected to MongoDB');

  // 🔁 ทำย้อนหลังทันทีตอนเปิด worker
  await catchUpPreGenerateDailyNumbers();
  await catchUpCreateDailyRounds();
  await catchUpSettleRounds();
  console.log('🟢 Catch-up completed');

  // 🔁 LOOP ทุก 1 นาที (หัวใจของระบบ)
  setInterval(async () => {
    if (running) return;
    running = true;

    try {
      // ❗ ไม่ส่ง now เข้าไป
      // lotteryEngine จะใช้ Asia/Bangkok ของตัวเอง
      await updateRoundStatuses(); // open → closing → drawn
      await settleDueRounds();     // drawn → settled
    } catch (err) {
      console.error('[WORKER] error:', err.message);
    } finally {
      running = false;
    }
  }, 60 * 1000);
}

boot();
