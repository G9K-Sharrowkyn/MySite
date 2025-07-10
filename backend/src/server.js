require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Connect to DB
connectDB();

const app = express();

// Security HTTP headers
app.use(helmet());

// Logging
app.use(morgan('combined'));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// CORS
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  credentials: true
}));

// Rate limiting global
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
// TODO: add more routes

// Legal docs (static text for now)
app.get('/privacy-policy', (req, res) => {
  res.type('text').send('Privacy Policy placeholder - replace with actual content.');
});
app.get('/terms-of-service', (req, res) => {
  res.type('text').send('Terms of Service placeholder - replace with actual content.');
});
app.get('/cookies', (req, res) => {
  res.type('text').send('Cookie Policy placeholder - replace with actual content.');
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));