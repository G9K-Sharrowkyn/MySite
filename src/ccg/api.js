import axios from 'axios';

const baseURL = process.env.REACT_APP_CCG_API_URL || '/api/ccg';
const API = axios.create({ baseURL, withCredentials: true });

API.interceptors.request.use((config) => {
  const storedToken = localStorage.getItem('token');
  if (storedToken && storedToken !== 'cookie-session') {
    const headers = config.headers || {};
    if (!headers.Authorization && !headers.authorization && !headers['x-auth-token']) {
      headers.Authorization = `Bearer ${storedToken}`;
    }
    config.headers = headers;
  }
  return config;
});

export const setAuthToken = (token) => {
  if (token && token !== 'cookie-session') {
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common['Authorization'];
  }
};

export default API;
