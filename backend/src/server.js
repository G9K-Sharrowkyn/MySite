require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const connectDB = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const csrf = require('csurf');

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

// CSRF protection for donation routes
const csrfProtection = csrf({ cookie: true });
app.use('/api/donate', csrfProtection, require('./routes/donationRoutes'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/divisions', require('./routes/divisionRoutes'));
app.use('/api/fights', require('./routes/fightRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/votes', require('./routes/voteRoutes'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
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