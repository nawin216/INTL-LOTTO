// middleware/authenticateSocket.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).lean();
    if (!user) return next(new Error('User not found'));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Auth failed'));
  }
};
