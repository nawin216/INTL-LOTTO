const express = require("express");
const http = require("http");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 10000;

// เชื่อมต่อ DB ก่อน
connectDB()
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
  });

app.get("/", (req, res) => {
  res.send("✅ DB CONNECTED - SERVER OK");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port:", PORT);
});
