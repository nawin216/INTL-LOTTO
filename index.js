const express = require("express");
const app = express();

// ⚠️ ใช้พอร์ตจาก Render เท่านั้น
const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";   // สำคัญมากสำหรับ Cloud

app.get("/", (req, res) => {
  res.send("INTL-LOTTO minimal server is working");
});

// ✅ ต้อง bind ที่ 0.0.0.0
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
