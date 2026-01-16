// index.js (TEST VERSION – ROUTES ONLY)

const express = require("express");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 10000;

// =======================
// MIDDLEWARE
// =======================
app.use(express.json());

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.send("✅ DB CONNECTED + ROUTES OK");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

// =======================
// TEST API ROUTES
// =======================

// จำลอง /api/auth
app.use("/api/auth", (req, res) => {
  res.json({
    ok: true,
    route: "/api/auth",
    method: req.method,
  });
});

// จำลอง /api/lottery
app.use("/api/lottery", (req, res) => {
  res.json({
    ok: true,
    route: "/api/lottery",
    method: req.method,
  });
});

// =======================
// 404 HANDLER
// =======================
app.use((req, res) => {
  res.status(404).json({ message: "❌ API endpoint not found" });
});

// =======================
// START SERVER
// =======================
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Test server running on port:", PORT);
});
