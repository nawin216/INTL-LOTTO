// index.js (RENDER TEST - ROUTES ONLY)

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");

// ========================
// 🔹 IMPORT ROUTES
// ========================
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
const lotteryTicketRoutes = require("./routes/lottery-tickets");
const adminExtraRoutes = require("./routes/admin-extra");
const lotteryAdminExtraRoutes = require("./routes/lottery-admin-extra");
const chatRoutes = require("./routes/chat");

// ========================
// 🔹 MIDDLEWARE
// ========================
const cookieParser = require("cookie-parser");
const authenticate = require("./middleware/authenticate");
const adminPageGuard = require("./middleware/adminPageGuard");

const app = express();
const PORT = process.env.PORT || 10000;
const viewsPath = path.join(__dirname, "views");

// ========================
// 🔹 CONNECT DB
// ========================
connectDB()
  .then(() => {
    console.log("✅ MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ========================
// 🔹 BASIC MIDDLEWARE
// ========================
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// 🔹 STATIC FILES
// ========================
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========================
// 🔹 HEALTH CHECK
// ========================
app.get("/", (req, res) => {
  res.send("✅ DB CONNECTED + ROUTES OK");
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// =========================
// 🔹 API ROUTES
// =========================
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
app.use("/api", adminExtraRoutes);
app.use("/api", lotteryAdminExtraRoutes);
app.use("/api/chat", chatRoutes);

// =========================
// 🔹 HTML ROUTES
// =========================
app.get("/index.html", (req, res) =>
  res.sendFile(path.join(viewsPath, "index.html"))
);
app.get("/wallet", (req, res) =>
  res.sendFile(path.join(viewsPath, "wallet.html"))
);
app.get("/profile", (req, res) =>
  res.sendFile(path.join(viewsPath, "profile.html"))
);
app.get("/deposit", (req, res) =>
  res.sendFile(path.join(viewsPath, "deposit.html"))
);
app.get("/withdraw", (req, res) =>
  res.sendFile(path.join(viewsPath, "withdraw.html"))
);
app.get("/lottery", (req, res) =>
  res.sendFile(path.join(viewsPath, "lottery.html"))
);
app.get("/lottery-chat", (req, res) =>
  res.sendFile(path.join(viewsPath, "lottery-chat.html"))
);

app.get("/admin-users", adminPageGuard, (req, res) => {
  res.sendFile(path.join(__dirname, "admin/admin-users.html"));
});

// =========================
// 🔹 404 HANDLER
// =========================
app.use((req, res) => {
  res.status(404).json({ message: "❌ API endpoint not found" });
});

// =========================
// 🔹 START SERVER
// =========================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Test server running on port:", PORT);
});
