import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const configureAxiosBaseUrl = () => {
  const envApiUrl = (process.env.REACT_APP_API_URL || '').trim();
  if (!envApiUrl) return;

  const isAbsolute = /^https?:\/\//i.test(envApiUrl);
  if (!isAbsolute) return;

  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocalhost) return;
  }

  axios.defaults.baseURL = envApiUrl.replace(/\/$/, '');
};

configureAxiosBaseUrl();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register service worker for PWA
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Unregister any existing service workers in development
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}
