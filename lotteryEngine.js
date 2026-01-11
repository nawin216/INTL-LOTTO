/*********************************************************
 * LOTTERY ENGINE – FINAL PRODUCTION VERSION (COMMONJS)
 * ✔ Timezone-safe (Asia/Bangkok)
 * ✔ Worker / Cron friendly
 * ✔ No duplicate settle
 * ✔ Can run 24/7
 *********************************************************/

const mongoose = require('mongoose');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

/* ===================== MODELS ===================== */
const LotteryRound = require('./models/LotteryRound');
const PreGeneratedDraw = require('./models/PreGeneratedDraw');
const Ticket = require('./models/Ticket');
const User = require('./models/User');
const Transaction = require('./models/Transaction');

/* ===================== CONFIG ===================== */
const TZ = 'Asia/Bangkok';
const ROUNDS_PER_DAY = 12;
const ROUND_INTERVAL_HOURS = 2;
const CLOSE_BEFORE_MINUTES = 5;
const LOOKBACK_DAYS = 5;

/* ===================== UTILS ===================== */
function nowBangkok() {
  return dayjs().tz(TZ).toDate();
}

function todayBangkok() {
  return dayjs().tz(TZ).format('YYYY-MM-DD');
}

function random8Digit() {
  return Math.floor(Math.random() * 100000000)
    .toString()
    .padStart(8, '0');
}

/* =====================================================
 * PRE-GENERATE NUMBERS
 * ===================================================*/
async function preGenerateDailyNumbers(date = todayBangkok()) {
  const count = await PreGeneratedDraw.countDocuments({ date });
  if (count >= ROUNDS_PER_DAY) return;

  for (let i = count + 1; i <= ROUNDS_PER_DAY; i++) {
    let number8;
    let dup = true;

    while (dup) {
      number8 = random8Digit();
      dup = await PreGeneratedDraw.exists({ date, number8 });
    }

    await PreGeneratedDraw.create({
      date,
      drawIndex: i,
      roundId: `${date}-R${i}`,
      number8,
      status: 'unused',
    });
  }

  console.log(`[ENGINE] Pre-generated numbers for ${date}`);
}

/* =====================================================
 * CREATE DAILY ROUNDS
 * ===================================================*/
async function createDailyRounds(date = todayBangkok()) {
  const count = await LotteryRound.countDocuments({ date });
  if (count >= ROUNDS_PER_DAY) return;

  const draws = await PreGeneratedDraw.find({
    date,
    status: 'unused',
  }).sort({ drawIndex: 1 });

  if (draws.length < ROUNDS_PER_DAY - count) {
    throw new Error(`[ENGINE] Not enough pre-generated numbers for ${date}`);
  }

  const baseDrawTime = dayjs.tz(`${date} 02:00`, TZ);

  const rounds = draws.map(d => ({
    date,
    roundNo: d.drawIndex,
    roundId: d.roundId,
    drawAt: baseDrawTime
      .add((d.drawIndex - 1) * ROUND_INTERVAL_HOURS, 'hour')
      .toDate(),
    result8: d.number8,
    status: 'open',
  }));

  await LotteryRound.insertMany(rounds);

  await PreGeneratedDraw.updateMany(
    { date },
    { $set: { status: 'assigned' } }
  );

  console.log(`[ENGINE] Created rounds for ${date}`);
}

/* =====================================================
 * UPDATE ROUND STATUS (TIMEZONE SAFE)
 * ===================================================*/
async function updateRoundStatuses() {
  const now = nowBangkok();

  // open → closing
  await LotteryRound.updateMany(
    {
      status: 'open',
      drawAt: {
        $lte: dayjs(now).add(CLOSE_BEFORE_MINUTES, 'minute').toDate(),
        $gt: now,
      },
    },
    { $set: { status: 'closing' } }
  );

  // closing → drawn
  await LotteryRound.updateMany(
    {
      status: 'closing',
      drawAt: { $lte: now },
    },
    { $set: { status: 'drawn' } }
  );
}

/* =====================================================
 * SETTLEMENT CORE
 * ===================================================*/
async function acquireSettleLock(roundId) {
  return LotteryRound.findOneAndUpdate(
    {
      roundId,
      status: 'drawn',
      settledAt: { $exists: false },
      settling: { $ne: true },
    },
    {
      $set: {
        settling: true,
        settlingAt: nowBangkok(),
      },
    },
    { new: true }
  );
}

async function settleRound(roundId, io) {
  const locked = await acquireSettleLock(roundId);
  if (!locked) return;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const round = await LotteryRound.findOne({ roundId }).session(session);
    if (!round || !round.result8) throw new Error('INVALID_ROUND');

    const tickets = await Ticket.find({
      roundId,
      status: 'pending',
    }).session(session);

    for (const ticket of tickets) {
      let payout = 0;

      for (const e of ticket.entries) {
        if (e.numbers === round.result8.slice(-e.digitCount)) {
          payout += e.potentialPayout;
        }
      }

      ticket.totalPayout = payout;
      ticket.settledAt = nowBangkok();
      ticket.status = payout > 0 ? 'won' : 'lost';

      if (payout > 0) {
  const user = await User.findById(ticket.userId).session(session);
  const before = user.wallet.balance;
  const after = before + payout;

  user.wallet.balance = after;
  await user.save({ session });

  await Transaction.create(
    [{
      userId: user._id,
      type: 'lottery_win',
      amount: payout,
      balanceBefore: before,
      balanceAfter: after,
      meta: { roundId, ticketId: ticket.ticketId },
    }],
    { session }
  );

  // 🔴 เพิ่มตรงนี้
  if (io && user && user._id) {
  io.to(user._id.toString()).emit("wallet:update", {
    balance: after,
    delta: payout,
    roundId,
    ticketId: ticket.ticketId
  });
}

}


      await ticket.save({ session });
    }

    round.status = 'settled';
    round.settledAt = nowBangkok();
    round.settling = false;
    await round.save({ session });

    // 🔴 แจ้งทุก client ว่างวดนี้ออกผลแล้ว
await session.commitTransaction();

// 🔔 แจ้งทุก client ว่างวดนี้ออกผลแล้ว
if (io) {
  io.emit("lottery:resultAnnounced", {
    roundId: round.roundId,
    result8: round.result8,
    status: round.status,
    settledAt: round.settledAt,
  });
}
    console.log(`[ENGINE] Settled ${roundId}`);
  } catch (err) {
    await session.abortTransaction();
    await LotteryRound.updateOne(
      { roundId },
      { $set: { settling: false } }
    );
    console.error(`[ENGINE] Failed settle ${roundId}`, err.message);
  } finally {
    session.endSession();
  }
}

/* =====================================================
 * AUTO / CATCH-UP (WORKER SAFE)
 * ===================================================*/
async function settleDueRounds(io) {
  const now = nowBangkok();

  const rounds = await LotteryRound.find({
    settledAt: { $exists: false },
    drawAt: { $lte: now },
  }).sort({ drawAt: 1 });

  for (const r of rounds) {
    await settleRound(r.roundId, io);
  }
}


async function catchUpPreGenerateDailyNumbers() {
  console.log('[ENGINE] Catch-up pre-generate start');

  const base = dayjs().tz(TZ).startOf('day');

  for (let i = LOOKBACK_DAYS; i >= 0; i--) {
    const date = base.subtract(i, 'day').format('YYYY-MM-DD');
    await preGenerateDailyNumbers(date);
  }

  console.log('[ENGINE] Catch-up pre-generate completed');
}

async function catchUpCreateDailyRounds() {
  console.log('[ENGINE] Catch-up create rounds start');

  const base = dayjs().tz(TZ).startOf('day');

  for (let i = LOOKBACK_DAYS; i >= 0; i--) {
    const date = base.subtract(i, 'day').format('YYYY-MM-DD');
    await createDailyRounds(date);
  }

  console.log('[ENGINE] Catch-up create rounds completed');
}

async function catchUpSettleRounds(io) {
  console.log('[ENGINE] Catch-up settle start');
  await settleDueRounds(io);
  console.log('[ENGINE] Catch-up settle completed');
}


/* =====================================================
 * EXPORT
 * ===================================================*/
module.exports = {
  // daily
  preGenerateDailyNumbers,
  createDailyRounds,
  updateRoundStatuses,

  // auto
  settleDueRounds,

  // boot / worker
  catchUpPreGenerateDailyNumbers,
  catchUpCreateDailyRounds,
  catchUpSettleRounds,
};
