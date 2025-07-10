# GeekFights - Complete Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- MongoDB (local or cloud)
- Git

### 1. MongoDB Setup

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# On Ubuntu/Debian:
sudo apt-get install mongodb

# On macOS with Homebrew:
brew install mongodb-community

# Start MongoDB
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS
```

**Option B: Docker MongoDB**
```bash
docker run -d --name nerdfights-mongo -p 27017:27017 mongo:6
```

**Option C: MongoDB Atlas (Cloud)**
1. Create free account at https://cloud.mongodb.com
2. Create cluster and get connection string

### 2. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env file with your settings:
# MONGO_URI=mongodb://localhost:27017/nerd-fights
# JWT_SECRET=your-super-secret-jwt-key-here
# CLIENT_ORIGIN=http://localhost:3000
# NODE_ENV=development

# Install dependencies
npm install

# Seed database with initial data
npm run seed:all

# Start development server
npm run dev
```

Backend will run on http://localhost:5000

### 3. Frontend Setup

```bash
# In project root
npm install
npm start
```

Frontend will run on http://localhost:3000

## 🔧 Environment Configuration

### Backend (.env)
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/nerd-fights
JWT_SECRET=YourSuperSecretJWTKeyMustBeLongAndSecure
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development
BMC_LINK=https://buymeacoffee.com/yourname
PAYPAL_LINK=https://paypal.me/yourname
```

## 📚 API Documentation

Once running, visit http://localhost:5000/api-docs for interactive API documentation.

### Key Endpoints

**Authentication:**
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/logout` - Logout user

**Divisions:**
- GET `/api/divisions` - List all divisions
- POST `/api/divisions/join` - Join a division
- GET `/api/divisions/user` - Get user's divisions

**Fights:**
- GET `/api/fights` - List all fights
- POST `/api/fights` - Create new fight
- POST `/api/fights/:id/vote` - Vote in fight

**Posts & Comments:**
- GET `/api/posts` - Get feed posts
- POST `/api/posts` - Create post
- GET `/api/comments/post/:id` - Get post comments

## 🎮 Using the Platform

### For Regular Users

1. **Register/Login**
   - Create account with email/password
   - GDPR consent required during registration

2. **Join Divisions**
   - Go to Divisions page
   - Select division and pick 2 characters
   - Characters become locked to your team

3. **Create Fights**
   - Use Create Fight page
   - Select characters for Team A vs Team B
   - Casual fights don't affect records

4. **Vote in Fights**
   - Vote in any active fight
   - Official fights count towards records
   - 72-hour voting window

5. **Interact**
   - Comment on fights and posts
   - Send messages to other users
   - View leaderboards

### For Moderators

1. **Create Official Fights**
   - Official fights affect user records
   - Can create title fights for champions
   - Manage division tournaments

2. **Moderate Content**
   - Access moderator panel
   - Review and manage posts
   - Handle user reports

## 🏆 Division System

### How It Works
1. Each division has unique character roster
2. Users pick 2-character teams when joining
3. Characters lock to prevent duplicates
4. Moderators create official matches
5. Winners advance, losers get eliminated
6. Champions get special titles and styling

### Division Types
- **Metahuman**: Enhanced humans
- **Cosmic**: Universe-level powers
- **Street Level**: Ground-level heroes
- **Magic**: Mystical arts masters

## 🔒 Security Features

- JWT authentication with httpOnly cookies
- Password hashing with bcrypt
- Rate limiting on auth endpoints
- CORS protection
- Helmet.js security headers
- Input validation and sanitization
- CSRF protection on donations

## 🌍 Legal Compliance

- GDPR compliant user consent
- Privacy policy endpoint: `/privacy-policy`
- Terms of service: `/terms-of-service`
- Cookie policy: `/cookies`
- Data deletion requests supported

## 💰 Donation Integration

- BuyMeACoffee support
- PayPal integration
- CSRF-protected donation tracking
- Donation history for logged users

## 🐛 Troubleshooting

### Common Issues

**401 Unauthorized errors:**
- Check JWT_SECRET in .env
- Verify token is being sent correctly
- Clear localStorage and re-login

**MongoDB connection failed:**
- Ensure MongoDB is running
- Check MONGO_URI in .env
- Verify database permissions

**Character images not loading:**
- Images should be in `/public/characters/`
- Check file names match database entries
- Ensure proper file extensions

**Division join fails:**
- Check if characters already taken
- Verify user not already in division
- Ensure proper team format

### Reset Database
```bash
# Clear all data and reseed
cd backend
npm run seed:all
```

### View Logs
```bash
# Backend logs
cd backend
npm run dev

# Check MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

## 🚀 Production Deployment

### Environment Setup
```env
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/nerdfights
JWT_SECRET=your-production-secret-key
CLIENT_ORIGIN=https://yourdomain.com
```

### Build Frontend
```bash
npm run build
```

### Start Production Server
```bash
cd backend
npm start
```

## 📱 Mobile Responsiveness

The platform is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones
- Progressive Web App (PWA) ready

## 🎨 UI Features

- Modern Facebook-like interface
- Dark/light theme support
- Real-time notifications
- Responsive design
- Character image galleries
- Interactive voting system
- Live chat messaging

## 🔄 Real-time Features

- Live vote counts
- Real-time notifications
- Instant messaging
- Live fight timers
- Dynamic leaderboards

## 📊 Analytics & Monitoring

- Request logging with Morgan
- Error tracking
- User activity monitoring
- Fight statistics
- Division performance metrics

---

## 🎯 Quick Test Checklist

After setup, verify these work:

- [ ] Register new user
- [ ] Login/logout
- [ ] Browse characters
- [ ] Join a division
- [ ] Create casual fight
- [ ] Vote in fights
- [ ] Post comments
- [ ] Send messages
- [ ] View notifications
- [ ] Access API docs at /api-docs

## 🆘 Support

For issues:
1. Check this guide first
2. Review console errors
3. Check backend logs
4. Verify environment variables
5. Test API endpoints directly

The platform is now fully functional with all requested features implemented!