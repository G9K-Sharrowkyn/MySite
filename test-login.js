const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testLogin() {
  try {
    console.log('🔧 Testing authentication system...\n');

    // 1. Create test user
    console.log('1. Creating test user...');
    try {
      await axios.post(`${API_BASE}/auth/create-test-user`);
      console.log('✅ Test user created successfully');
    } catch (error) {
      if (error.response?.data?.message === 'Test user already exists') {
        console.log('✅ Test user already exists');
      } else {
        console.log('❌ Error creating test user:', error.response?.data);
      }
    }

    // 2. Test login with test user
    console.log('\n2. Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@example.com',
      password: 'test123'
    });
    console.log('✅ Login successful');
    console.log('Token:', loginResponse.data.token ? 'Present' : 'Missing');

    // 3. Test leaderboard endpoint
    console.log('\n3. Testing leaderboard endpoint...');
    const leaderboardResponse = await axios.get(`${API_BASE}/users/leaderboard`);
    console.log('✅ Leaderboard accessible');
    console.log('Users found:', leaderboardResponse.data.length);

    // 4. Test official posts endpoint
    console.log('\n4. Testing official posts endpoint...');
    const postsResponse = await axios.get(`${API_BASE}/posts/official?limit=6`);
    console.log('✅ Official posts accessible');
    console.log('Fights found:', postsResponse.data.fights?.length || 0);

    console.log('\n🎉 All tests passed! The authentication system is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  }
}

testLogin(); 