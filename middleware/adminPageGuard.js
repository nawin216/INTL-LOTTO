const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function adminPageGuard(req, res, next) {
  const token = req.cookies.admin_token;

  if (!token) {
    return res.redirect('/index.html');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    if (!user || user.role !== 'admin') {
      return res.redirect('/index.html');
    }

    req.user = user;
    next();
  } catch (err) {
    return res.redirect('/index.html');
  }
};
