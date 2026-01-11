const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// test route
app.get("/", (req, res) => {
  res.status(200).send("INTL-LOTTO is working on Render ✅");
});

// สำคัญมาก: อย่าระบุ host และอย่าใช้ http.createServer
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
