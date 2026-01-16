// index.js (RENDER DEBUG VERSION)

const express = require("express");
const http = require("http");

const app = express();

// Render จะส่ง PORT มาให้ทาง env เสมอ
const PORT = process.env.PORT || 10000;

// ROUTE ทดสอบ
app.get("/", (req, res) => {
  res.send("✅ RENDER OK - Express server is running");
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// สำคัญมาก: ต้อง bind ที่ 0.0.0.0 เท่านั้น
const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Test server running on port:", PORT);
});
