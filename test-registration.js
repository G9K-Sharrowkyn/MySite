const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testRegistrationAndLogin() {
  try {
    console.log('🔧 Testing Registration and Login System...\n');

    // Generate unique test data
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;
    const testUsername = `testuser${timestamp}`;
    const testPassword = 'test123456';

    // 1. Test Registration
    console.log('1. Testing user registration...');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      username: testUsername,
      email: testEmail,
      password: testPassword,
      consent: {
        privacyPolicy: true,
        termsOfService: true,
        cookies: true,
        marketingEmails: false
      }
    });
    
    console.log('✅ Registration successful');
    console.log('User ID:', registerResponse.data.userId);
    console.log('Token:', registerResponse.data.token ? 'Present' : 'Missing');

    // 2. Test Login with new user
    console.log('\n2. Testing login with newly registered user...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    
    console.log('✅ Login successful');
    console.log('User ID:', loginResponse.data.userId);
    console.log('Token:', loginResponse.data.token ? 'Present' : 'Missing');

    // 3. Test protected endpoints with token
    console.log('\n3. Testing protected endpoints...');
    const token = loginResponse.data.token;
    
    // Test notifications endpoint
    try {
      const notificationsResponse = await axios.get(`${API_BASE}/notifications/unread/count`, {
        headers: { 'x-auth-token': token }
      });
      console.log('✅ Notifications endpoint working');
      console.log('Unread count:', notificationsResponse.data.unreadCount);
    } catch (error) {
      console.log('⚠️ Notifications endpoint error:', error.response?.data?.message || error.message);
    }

    // Test profile endpoint
    try {
      const profileResponse = await axios.get(`${API_BASE}/users/${loginResponse.data.userId}`, {
        headers: { 'x-auth-token': token }
      });
      console.log('✅ Profile endpoint working');
      console.log('Username:', profileResponse.data.username);
    } catch (error) {
      console.log('⚠️ Profile endpoint error:', error.response?.data?.message || error.message);
    }

    // 4. Test public endpoints
    console.log('\n4. Testing public endpoints...');
    
    // Test leaderboard
    try {
      const leaderboardResponse = await axios.get(`${API_BASE}/users/leaderboard`);
      console.log('✅ Leaderboard endpoint working');
      console.log('Users found:', leaderboardResponse.data.length);
    } catch (error) {
      console.log('⚠️ Leaderboard endpoint error:', error.response?.data?.message || error.message);
    }

    // Test official posts
    try {
      const postsResponse = await axios.get(`${API_BASE}/posts/official?limit=6`);
      console.log('✅ Official posts endpoint working');
      console.log('Fights found:', postsResponse.data.fights?.length || 0);
    } catch (error) {
      console.log('⚠️ Official posts endpoint error:', error.response?.data?.message || error.message);
    }

    // 5. Test duplicate registration (should fail)
    console.log('\n5. Testing duplicate registration (should fail)...');
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        username: testUsername,
        email: testEmail,
        password: testPassword,
        consent: {
          privacyPolicy: true,
          termsOfService: true,
          cookies: true,
          marketingEmails: false
        }
      });
      console.log('❌ Duplicate registration should have failed');
    } catch (error) {
      if (error.response?.data?.message === 'User already exists') {
        console.log('✅ Duplicate registration correctly rejected');
      } else {
        console.log('⚠️ Unexpected error on duplicate registration:', error.response?.data?.message || error.message);
      }
    }

    // 6. Test invalid login (should fail)
    console.log('\n6. Testing invalid login (should fail)...');
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      });
      console.log('❌ Invalid login should have failed');
    } catch (error) {
      if (error.response?.data?.message === 'Invalid credentials') {
        console.log('✅ Invalid login correctly rejected');
      } else {
        console.log('⚠️ Unexpected error on invalid login:', error.response?.data?.message || error.message);
      }
    }

    console.log('\n🎉 Registration and Login System Test Complete!');
    console.log('📧 Test user email:', testEmail);
    console.log('👤 Test username:', testUsername);
    console.log('🔑 Test password:', testPassword);

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
  }
}

testRegistrationAndLogin(); 