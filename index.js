const express = require("express");
const app = express();

app.use(express.json());

// import routes
const authRoutes = require("./routes/auth");
const lotteryRoutes = require("./routes/lottery");

// mount
app.use("/api/auth", authRoutes);
app.use("/api/lottery", lotteryRoutes);

// test route
app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});
