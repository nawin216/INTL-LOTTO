const express = require("express");
const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ ok: true, route: "auth" });
});

module.exports = router;
