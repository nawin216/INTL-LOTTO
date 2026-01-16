// index.js (RENDER TEST VERSION)

const express = require("express");
const http = require("http");

const app = express();

// Render จะส่ง PORT มาให้ผ่าน env
const PORT = process.env.PORT || 10000;

// =========================
// 🔎 ROUTE ทดสอบ (ไม่พึ่ง DB / worker / socket)
// =========================
app.get("/", (req, res) => {
  res.send("✅ RENDER OK - Express server is running");
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// =========================
// 🚀 START SERVER (สำคัญมากสำหรับ Render)
// =========================
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Test server running on port:", PORT);
});
