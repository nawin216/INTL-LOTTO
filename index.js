// index.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const depositRoutes = require("./routes/depositRoutes");
const adminDepositRoutes = require("./routes/adminDepositRoutes");
const adminWithdrawRoutes = require("./routes/adminWithdrawRoutes");
const notificationRoutes = require("./routes/notifications");
const withdrawRoutes = require("./routes/withdrawRoutes");
const walletRoutes = require("./routes/wallet");
const profileRoutes = require("./routes/profile");
const lotteryRoutes = require("./routes/lottery");
const adminRoutes = require("./routes/admin");
const authenticate = require('./middleware/authenticate');
const isAdmin = require('./middleware/isAdmin');
const adminPageGuard = require('./middleware/adminPageGuard');
const lotteryTicketRoutes = require("./routes/lottery-tickets");
const Notification = require("./models/Notification");
const cookieParser = require('cookie-parser');
const { sendTelegramAlert } = require("./utils/telegram");
const {
  catchUpSettleRounds,
  updateRoundStatuses,
  settleDueRounds
} = require('./lotteryEngine');



// เพิ่มส่วนเสริมเดิม
const adminExtraRoutes = require("./routes/admin-extra");
const lotteryAdminExtraRoutes = require("./routes/lottery-admin-extra");

// 🔹 โมเดลที่ใช้กับแชท
const ChatRoom = require("./models/ChatRoom");
const ChatMessage = require("./models/ChatMessage");
const User = require("./models/User");

// 🔹 Route แชท
const chatRoutes = require("./routes/chat");

const app = express();
const PORT = process.env.PORT || 5000;
const viewsPath = path.join(__dirname, "views");

// ✅ เชื่อมต่อ MongoDB
connectDB()
  .then(async () => {
    console.log("✅ MongoDB connected successfully");
    console.log("🔁 Database ready");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });


// ✅ สร้าง HTTP server และใช้ socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// 🔁 Catch-up settle หลังจากมี io แล้ว
(async () => {
  try {
    await catchUpSettleRounds(io);
    console.log("🔁 Catch-up settle rounds completed");
  } catch (err) {
    console.error("❌ catchUpSettleRounds error:", err);
  }
})();

// ✅ ส่ง `io` ให้ทุก request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ ตั้งค่า CORS และ middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ เสิร์ฟ static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static("uploads")); // serve รูปสลิป + รูปแชท

// =========================
//  เส้นทาง API (mount routers)
// =========================

// เส้นทางเดิมที่มีอยู่
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/lottery", lotteryRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/admin/deposits", adminDepositRoutes);
app.use("/api/withdrawals", withdrawRoutes);
app.use("/api/admin/withdrawals", adminWithdrawRoutes);
app.use("/api/lottery", lotteryTicketRoutes);
app.use("/api", notificationRoutes);

// --------- ไฟล์ใหม่ (patch เดิม) ----------
app.use("/api", adminExtraRoutes);
app.use("/api", lotteryAdminExtraRoutes);

// 🔹 เส้นทาง API แชท (ผู้ใช้คุยกับแอดมิน)
app.use("/api/chat", chatRoutes);
app.get("/api/state", authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // ✅ ดึงจาก wallet.balance
    const user = await User.findById(userId)
      .select("wallet")
      .lean();

    const balance = user?.wallet?.balance ?? 0;

    let hasNotification = false;
    try {
      const Notification = require("./models/Notification");
      const unreadCount = await Notification.countDocuments({
        user: userId,
        isRead: false,
      });
      hasNotification = unreadCount > 0;
    } catch (_) {}

    let lotteryResult = null;
    let lotteryPeriod = null;
    try {
      const LotteryRound = require("./models/LotteryRound");
      const latestRound = await LotteryRound.findOne({ status: "RESULT" })
        .sort({ resultAt: -1 })
        .select("result period")
        .lean();

      if (latestRound) {
        lotteryResult = latestRound.result;
        lotteryPeriod = latestRound.period;
      }
    } catch (_) {}

    res.json({
      serverTime: new Date(),
      balance,
      hasNotification,
      lotteryResult,
      lotteryPeriod,
    });
  } catch (err) {
    console.error("❌ /api/state error:", err);
    res.status(500).json({ message: "state error" });
  }
});

// =========================
// 🔔 Notification helper
// =========================
async function sendUserNotification(userId, title, message, type = "system", link = null) {
  try {
    // 1️⃣ บันทึกลง MongoDB
    const noti = await Notification.create({
      user: userId,        // 👈 ตรงกับ model ของคุณ
      title,
      message,
      type,
      link,
      isRead: false,
      createdAt: new Date(),
    });

    // 2️⃣ ส่ง realtime ไปยัง client ของ user นี้
    io.to(userId.toString()).emit("notification:new", {
      id: noti._id,
      title,
      message,
      type,
      link,
    });

    return noti;
  } catch (err) {
    console.error("sendUserNotification error:", err);
  }
}


// =========================
//  เส้นทาง HTML
// =========================
app.get("/", (req, res) =>
  res.sendFile(path.join(viewsPath, "index.html"))
);
app.get("/index.html", (req, res) =>
  res.sendFile(path.join(viewsPath, "index.html"))
);
app.get("/wallet", (req, res) =>
  res.sendFile(path.join(viewsPath, "wallet.html"))
);
app.get("/profile", (req, res) =>
  res.sendFile(path.join(viewsPath, "profile.html"))
);
app.get("/binary-trade-v2", (req, res) =>
  res.sendFile(path.join(viewsPath, "binary-trade-v2.html"))
);
app.get("/deposit", (req, res) =>
  res.sendFile(path.join(viewsPath, "deposit.html"))
);
app.get("/withdraw", (req, res) =>
  res.sendFile(path.join(viewsPath, "withdraw.html"))
);
app.get("/transaction-history", (req, res) =>
  res.sendFile(path.join(viewsPath, "transaction-history.html"))
);
app.get("/personal-info", (req, res) =>
  res.sendFile(path.join(viewsPath, "personal-info.html"))
);
app.get("/lottery", (req, res) =>
  res.sendFile(path.join(viewsPath, "lottery.html"))
);
app.get("/lottery/bill/:ticketId", (req, res) =>
  res.sendFile(path.join(viewsPath, "bill.html"))
);
app.get("/lottery-history", (req, res) =>
  res.sendFile(path.join(__dirname, "views", "lottery-history.html"))
);
app.get("/lottery-chat", (req, res) =>
  res.sendFile(path.join(viewsPath, "lottery-chat.html"))
);

// หน้าลืมรหัสผ่าน
app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(viewsPath, "reset-password.html"));
});

app.get("/notifications", (req, res) => {
  res.sendFile(path.join(viewsPath, "notifications.html"));
});

app.get('/admin-users', adminPageGuard,  (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/admin-users.html'));
});

app.get('/admin-lottery', adminPageGuard,  (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/admin-lottery.html'));
});

app.get('/admin-chat', adminPageGuard,  (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/admin-chat.html'));
});

app.get('/admin-user-detail', adminPageGuard,  (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/admin-user-detail.html'));
});

// =========================
//  Socket.IO auth (optional สำหรับแชท)
// =========================
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      // ไม่มี token ก็ปล่อยผ่าน (ใช้สำหรับ withdraw events เดิม)
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) return next();

    // เก็บ userId ไว้บน socket
    socket.userId = userId;
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    // ไม่ block connection เดิม ให้ใช้เฉพาะฟีเจอร์ที่ไม่ต้อง auth ได้
    next();
  }
});

// ✅ socket events
io.on("connection", async (socket) => {
  console.log("✅ Client connected to WebSocket!");
  
  

  // --------- ฟีเจอร์เดิม: withdraw events ----------
  socket.on("withdrawRequest", () => io.emit("refreshWithdraws"));
  socket.on("withdrawApproved", () => io.emit("refreshWithdraws"));
  socket.on("withdrawRejected", () => io.emit("refreshWithdraws"));
  socket.on("withdrawCompleted", () => io.emit("refreshWithdraws"));

  // ---------- ฟีเจอร์ใหม่: แชท User ↔ Admin ----------

  // ถ้าเป็นฝั่ง user (มี userId จาก JWT) ให้ join ห้องตัวเอง
  if (socket.userId) {
    socket.join(socket.userId.toString());
    try {
      let room = await ChatRoom.findOne({ userId: socket.userId });
      if (!room) {
        room = await ChatRoom.create({ userId: socket.userId });
      }

      const roomId = room._id.toString();
      socket.join(roomId);
      socket.chatRoomId = roomId;

      console.log(`📨 User ${socket.userId} joined chat room ${roomId}`);
    } catch (err) {
      console.error("Error joining chat room:", err);
    }
  }

  // ผู้ใช้ส่งข้อความ (ฝั่ง lottery-chat.html ใช้ event นี้)
  socket.on("chat:send", async (payload) => {
    try {
      if (!socket.userId) return;

      const { roomId: clientRoomId, text, imageUrl } = payload || {};

      let room = null;
      if (clientRoomId) {
        room = await ChatRoom.findById(clientRoomId);
      }
      if (!room) {
        room = await ChatRoom.findOne({ userId: socket.userId });
        if (!room) {
          room = await ChatRoom.create({ userId: socket.userId });
        }
      }
      const roomId = room._id.toString();
      socket.join(roomId);

      const message = await ChatMessage.create({
        roomId: room._id,
        senderType: "user",
        text: text || "",
        imageUrl: imageUrl || null,
      });

      room.lastMessage =
        text || (imageUrl ? "ส่งรูปภาพ" : room.lastMessage);
      room.updatedAt = new Date();
      await room.save();

      const msgObj = message.toObject();
      io.to(roomId).emit("chat:message", msgObj);

      // 🔔 แจ้งเตือน Telegram เมื่อผู้ใช้ทักหาแอดมิน
      try {
        const user = await User.findById(socket.userId)
          .select("uid email")
          .lean();

        const uid = user?.uid || socket.userId;
        const email = user?.email || "-";
        const preview = text
          ? text.slice(0, 80)
          : imageUrl
          ? "[ส่งรูปภาพ]"
          : "[ไม่มีข้อความ]";

        await sendTelegramAlert(
          `💬 มีข้อความใหม่จากผู้ใช้\n` +
            `UID: ${uid}\n` +
            `Email: ${email}\n` +
            `ข้อความ: ${preview}`
        );
      } catch (err) {
        console.error("telegram chat notify error:", err.message);
      }
    } catch (err) {
      console.error("chat:send error:", err);
    }
  });

  // แอดมินเลือกเข้าห้องไหน → join ห้องนั้น
  socket.on("chat:joinRoom", async (roomId) => {
    try {
      if (!roomId) return;
      socket.join(roomId);
      console.log("socket joined room:", roomId);
    } catch (err) {
      console.error("chat:joinRoom error:", err);
    }
  });

  // แอดมินส่งข้อความ (ฝั่ง admin-chat.html ใช้ event นี้)
  socket.on("chat:adminSend", async (payload) => {
    try {
      const { roomId, text, imageUrl } = payload || {};
      if (!roomId || (!text && !imageUrl)) return;

      const message = await ChatMessage.create({
        roomId,
        senderType: "admin",
        text: text || "",
        imageUrl: imageUrl || null,
      });

      await ChatRoom.updateOne(
        { _id: roomId },
        {
          lastMessage:
            text || (imageUrl ? "ส่งรูปภาพจากแอดมิน" : ""),
          updatedAt: new Date(),
        }
      );

      const msgObj = message.toObject();
      io.to(roomId).emit("chat:message", msgObj);
    } catch (err) {
      console.error("chat:adminSend error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected from WebSocket.");
  });
});

// ✅ จัดการ 404
app.use((req, res, next) => {
  if (req.path.endsWith(".html")) {
    return res.status(404).sendFile(path.join(viewsPath, "index.html"));
  }
  res.status(404).json({ message: "❌ API endpoint not found" });
});

// ✅ จัดการ error รวม
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.message);
  res.status(500).json({ message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์!" });
});

// =========================
// 🎯 Lottery Engine Auto Runner
// =========================

// ⏰ อัปเดตสถานะงวด: open → closing → drawn (ตามเวลา)
// เรียกทุก 30 วินาที
setInterval(async () => {
  try {
    await updateRoundStatuses();
  } catch (err) {
    console.error("❌ updateRoundStatuses error:", err);
  }
}, 30 * 1000);

// 💰 จ่ายเงิน + ประกาศผล + ยิง socket ไปยัง client
// เรียกทุก 10 วินาที
setInterval(async () => {
  try {
    await settleDueRounds(io); // 👈 สำคัญ: ต้องส่ง io เข้าไป
  } catch (err) {
    console.error("❌ settleDueRounds error:", err);
  }
}, 10 * 1000);


// ✅ เริ่มเซิร์ฟเวอร์
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});


