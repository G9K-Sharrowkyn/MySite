const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function loginModerator() {
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'moderator@site.local',
      password: 'mod1234'
    });
    console.log(loginResponse.data.token);
  } catch (error) {
    console.error('Error logging in:', error.response?.data || error.message);
  }
}

loginModerator();
