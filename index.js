// index.js (RENDER TEST VERSION)

const express = require("express");
const http = require("http");

const app = express();

// Render จะ inject PORT มาให้เสมอ
const PORT = process.env.PORT || 10000;

// ==========================
// 🧪 TEST ROUTES
// ==========================

app.get("/", (req, res) => {
  res.send("✅ RENDER OK - Express server is running");
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// ==========================
// 🚀 START SERVER (สำคัญมาก)
// ==========================

const server = http.createServer(app);

// ❗ ต้อง bind ที่ 0.0.0.0 เท่านั้น บน Render
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Test server running on port:", PORT);
});
