// worker.js

const {
  updateRoundStatuses,
  settleDueRounds,
  catchUpPreGenerateDailyNumbers,
  catchUpCreateDailyRounds,
  catchUpSettleRounds,
} = require('./lotteryEngine');

let running = false;

async function startWorker() {
  console.log('🟢 Worker started');

  // 🔁 ทำย้อนหลังทันทีตอนเริ่ม
  await catchUpPreGenerateDailyNumbers();
  await catchUpCreateDailyRounds();
  await catchUpSettleRounds();
  console.log('🟢 Catch-up completed');

  // 🔁 LOOP ทุก 1 นาที
  setInterval(async () => {
    if (running) return;
    running = true;

    try {
      await updateRoundStatuses();
      await settleDueRounds();
    } catch (err) {
      console.error('[WORKER] error:', err.message);
    } finally {
      running = false;
    }
  }, 60 * 1000);
}

module.exports = { startWorker };
