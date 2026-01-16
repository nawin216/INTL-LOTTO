// index.js (FINAL – RENDER + API ROUTES)

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

const connectDB = require('./config/db');

// 🔗 IMPORT ROUTES
const authRoutes = require('./routes/auth');
const lotteryRoutes = require('./routes/lottery');

const app = express();

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());

// =======================
// BASIC TEST ROUTES
// =======================
app.get('/', (req, res) => {
  res.send('✅ DB CONNECTED + ROUTES OK');
});

app.get('/ping', (req, res) => {
  res.json({ status: 'alive' });
});

// =======================
// API ROUTES (จุดสำคัญ)
// =======================
app.use('/api/auth', authRoutes);
app.use('/api/lottery', lotteryRoutes);

// =======================
// 404 HANDLER
// =======================
app.use((req, res) => {
  res.status(404).json({ message: '❌ API endpoint not found' });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 10000;
const server = http.createServer(app);

connectDB()
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 Server running on port:', PORT);
    });
  })
  .catch((err) => {
    console.error('❌ DB connection error:', err);
  });
