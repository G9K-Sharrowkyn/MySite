const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';

async function debugToken() {
  try {
    console.log('🔍 Debugging Token Authentication...\n');

    // 1. Register a user
    console.log('1. Registering user...');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      username: 'debuguser',
      email: 'debug@example.com',
      password: 'debug123',
      consent: {
        privacyPolicy: true,
        termsOfService: true,
        cookies: true,
        marketingEmails: false
      }
    });

    const token = registerResponse.data.token;
    const userId = registerResponse.data.userId;
    
    console.log('✅ Registration successful');
    console.log('Token:', token.substring(0, 20) + '...');
    console.log('User ID:', userId);

    // 2. Decode the token to see what's in it
    console.log('\n2. Decoding token...');
    const decoded = jwt.decode(token);
    console.log('Decoded token:', JSON.stringify(decoded, null, 2));

    // 3. Test different token formats
    console.log('\n3. Testing different token formats...');
    
    // Test with x-auth-token header
    try {
      const response1 = await axios.get(`${API_BASE}/notifications/unread/count`, {
        headers: { 'x-auth-token': token }
      });
      console.log('✅ x-auth-token header works');
    } catch (error) {
      console.log('❌ x-auth-token header failed:', error.response?.data?.message);
    }

    // Test with Authorization Bearer header
    try {
      const response2 = await axios.get(`${API_BASE}/notifications/unread/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Authorization Bearer header works');
    } catch (error) {
      console.log('❌ Authorization Bearer header failed:', error.response?.data?.message);
    }

    // 4. Test with the exact same token that worked for login
    console.log('\n4. Testing with login token...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'debug@example.com',
      password: 'debug123'
    });
    
    const loginToken = loginResponse.data.token;
    console.log('Login token:', loginToken.substring(0, 20) + '...');
    
    try {
      const response3 = await axios.get(`${API_BASE}/notifications/unread/count`, {
        headers: { 'x-auth-token': loginToken }
      });
      console.log('✅ Login token works for notifications');
    } catch (error) {
      console.log('❌ Login token failed for notifications:', error.response?.data?.message);
    }

    // 5. Test a simple protected endpoint
    console.log('\n5. Testing simple protected endpoint...');
    try {
      const response4 = await axios.get(`${API_BASE}/users/${userId}`, {
        headers: { 'x-auth-token': loginToken }
      });
      console.log('✅ User profile endpoint works');
      console.log('Username:', response4.data.username);
    } catch (error) {
      console.log('❌ User profile endpoint failed:', error.response?.data?.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

debugToken(); 