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
app.use('/api/divisions', require('./routes/divisionRoutes'));
app.use('/api/fights', require('./routes/fightRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/votes', require('./routes/voteRoutes'));
app.use('/api/characters', require('./routes/characterRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/tournaments', require('./routes/tournamentRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/donate', require('./routes/donationRoutes'));
app.use('/api/community', require('./routes/communityRoutes'));
app.use('/api', require('./routes/featureRoutes'));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Legal docs (static text for now)
app.get('/privacy-policy', (req, res) => {
  res.type('text').send(`
    PRIVACY POLICY
    
    Last updated: ${new Date().toLocaleDateString()}
    
    1. INFORMATION WE COLLECT
    We collect information you provide directly to us, such as when you create an account, participate in fights, or contact us.
    
    2. HOW WE USE YOUR INFORMATION
    We use the information we collect to provide, maintain, and improve our services.
    
    3. SHARING OF INFORMATION
    We do not sell, trade, or otherwise transfer your personal information to third parties.
    
    4. DATA RETENTION
    We retain your information for as long as your account is active or as needed to provide services.
    
    5. YOUR RIGHTS
    You have the right to access, update, or delete your personal information.
    
    Contact us at: support@geekfights.com
  `);
});

app.get('/terms-of-service', (req, res) => {
  res.type('text').send(`
    TERMS OF SERVICE
    
    Last updated: ${new Date().toLocaleDateString()}
    
    1. ACCEPTANCE OF TERMS
    By using GeekFights, you agree to these terms.
    
    2. USE OF SERVICE
    You may use our service for lawful purposes only.
    
    3. USER ACCOUNTS
    You are responsible for maintaining the confidentiality of your account.
    
    4. PROHIBITED CONDUCT
    You may not use the service to harass, abuse, or harm others.
    
    5. TERMINATION
    We may terminate your account for violations of these terms.
    
    Contact us at: support@geekfights.com
  `);
});

app.get('/cookies', (req, res) => {
  res.type('text').send(`
    COOKIE POLICY
    
    Last updated: ${new Date().toLocaleDateString()}
    
    1. WHAT ARE COOKIES
    Cookies are small text files stored on your device.
    
    2. HOW WE USE COOKIES
    We use cookies to authenticate users and improve user experience.
    
    3. TYPES OF COOKIES
    - Essential cookies: Required for the website to function
    - Authentication cookies: Keep you logged in
    
    4. YOUR CHOICES
    You can control cookies through your browser settings.
    
    Contact us at: support@geekfights.com
  `);
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));