// index.js (TEST VERSION – Routes Only)

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// 🔧 PORT (Render จะส่งมาให้ใน env)
const PORT = process.env.PORT || 10000;

// =========================
//  Middleware
// =========================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
//  TEST ROUTES (พื้นฐาน)
// =========================
app.get("/", (req, res) => {
  res.send("✅ DB CONNECTED + ROUTES OK");
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// =========================
//  LOAD ROUTES (เฉพาะ API)
// =========================
try {
  const authRoutes = require("./routes/auth");
  const lotteryRoutes = require("./routes/lottery");

  app.use("/api/auth", authRoutes);
  app.use("/api/lottery", lotteryRoutes);

  console.log("✅ Routes loaded: /api/auth, /api/lottery");
} catch (err) {
  console.error("❌ Error loading routes:", err.message);
}

// =========================
//  404 HANDLER
// =========================
app.use((req, res) => {
  res.status(404).json({ message: "❌ API endpoint not found" });
});

// =========================
//  START SERVER
// =========================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Test server running on port:", PORT);
});
