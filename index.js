const express = require("express");
const app = express();

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("RENDER OK");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

app.listen(PORT, () => {
  console.log("Test server running on", PORT);
});

