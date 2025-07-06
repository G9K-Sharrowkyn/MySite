# Troubleshooting Guide

## ✅ RESOLVED: Profile Error: "Nie można znaleźć Twojego profilu. Zaloguj się ponownie."

This error has been successfully resolved! The authentication system is now working correctly. Here are the fixes that were applied:

### 1. Port Configuration Fixed
- **Problem**: Frontend and backend were both trying to use port 5000
- **Solution**: Changed frontend port to 3000 in `.env` file
- **Result**: Backend runs on port 5000, frontend on port 3000

### 2. Proxy Configuration Added
- **Problem**: API requests weren't being properly proxied to backend
- **Solution**: Added `src/setupProxy.js` for explicit proxy configuration
- **Result**: All `/api/*` requests are now properly forwarded to backend

### 3. Authentication Error Handling Improved
- **Problem**: 401 errors weren't handled gracefully
- **Solution**: Added automatic logout on token expiration/invalidation
- **Result**: Users are automatically logged out when tokens become invalid

### 4. Image Loading Issues Fixed
- **Problem**: Placeholder images from via.placeholder.com were not loading
- **Solution**: Replaced all external placeholder URLs with local SVG alternatives
- **Result**: All images now load correctly without network dependencies

## How to Start the Application

### Option 1: Use the batch file (Recommended)
```bash
# Run this from the my-site directory
start-dev.bat
```

### Option 2: Manual startup
```bash
# Terminal 1: Start backend
cd backend
node server.js

# Terminal 2: Start frontend (in a new terminal)
npm start
```

### Expected Behavior
- Backend should start on http://localhost:5000
- Frontend should start on http://localhost:3000
- API requests from frontend are automatically proxied to backend

## Current Status

✅ **Authentication**: Working correctly
✅ **Profile Loading**: Users can view their profiles
✅ **API Communication**: Frontend properly communicates with backend
✅ **Image Loading**: All placeholder images load correctly
✅ **Port Configuration**: No conflicts between frontend and backend

## Common Issues

### 1. "Cannot find your profile" error
- **Cause**: Invalid or expired authentication token
- **Solution**: Log out and log back in

### 2. API requests going to wrong port
- **Cause**: Proxy not working or wrong port configuration
- **Solution**: Ensure setupProxy.js is in place and restart frontend

### 3. Backend not responding
- **Cause**: Backend not running or running on wrong port
- **Solution**: Check that backend is running on port 5000

## Test Accounts

You can use these existing accounts for testing:
- Email: `invinciblecharles@wp.pl` (username: ultracode1)
- Email: `testuser@example.com` (username: testuser)
- Email: `moderator@site.local` (username: moderator)

Note: You'll need to know the passwords or create new accounts.