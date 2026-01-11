// middlewares/isAdmin.js
module.exports = function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "คุณยังไม่ได้เข้าสู่ระบบ" });
  }
  // ถ้าใน User schema ของคุณเก็บ role เป็น field ชื่อ 'role'
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "คุณไม่มีสิทธิ์เข้าถึง (Admin เท่านั้น)" });
  }
  next();
};
