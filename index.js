// index.js (STEP 3 - WITH ROUTES ONLY)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");

// routes
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const depositRoutes = require("./routes/depositRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const profileRoutes = require("./routes/profile");
const lotteryRoutes = require("./routes/lottery");
const walletRoutes = require("./routes/wallet");

const app = express();
const PORT = process.env.PORT || 10000;

// ====== CONNECT DB ======
connectDB()
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

// ====== MIDDLEWARE ======
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== STATIC ======
app.use(express.static(path.join(__dirname, "public")));

// ====== ROUTES ======
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/lottery", lotteryRoutes);
app.use("/api/wallet", walletRoutes);

// ====== TEST ROUTES ======
app.get("/", (req, res) => {
  res.send("✅ DB CONNECTED + ROUTES OK");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

// ====== START SERVER ======
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});
