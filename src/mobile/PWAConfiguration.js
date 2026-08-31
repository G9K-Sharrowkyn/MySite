import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';
import './PWAConfiguration.css';

const PWAConfiguration = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [pushSubscription, setPushSubscription] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(
    process.env.REACT_APP_VAPID_PUBLIC_KEY || ''
  );

  const fetchVapidPublicKey = useCallback(async () => {
    if (vapidPublicKey) return vapidPublicKey;
    try {
      const response = await apiFetch('/api/push/vapid-public-key');
      const data = await response.json();
      const publicKey = data?.publicKey || '';
      if (publicKey) setVapidPublicKey(publicKey);
      return publicKey;
    } catch (error) {
      console.error('Unable to fetch VAPID public key:', error);
      return '';
    }
  }, [vapidPublicKey]);

  useEffect(() => {
    // Check if app is installed
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    registerServiceWorker();
    // Initialize push notifications
    initializePushNotifications();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchVapidPublicKey();
  }, [fetchVapidPublicKey]);

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered: ', registration);
      } catch (registrationError) {
        console.log('SW registration failed: ', registrationError);
      }
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

  const initializePushNotifications = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscription(subscription);
      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    }
  };

  const installApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstalled(true);
      }
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        subscribeToPushNotifications();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const subscribeToPushNotifications = async () => {
    try {
      const publicKey = vapidPublicKey || await fetchVapidPublicKey();
      if (!publicKey) {
        console.warn('Missing VAPID public key, push disabled.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const authToken = localStorage.getItem('token');
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      setPushSubscription(subscription);
      
      // Send subscription to server
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'x-auth-token': authToken } : {})
        },
        body: JSON.stringify({ subscription }),
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };

  const unsubscribeFromPushNotifications = async () => {
    try {
      if (pushSubscription) {
        await pushSubscription.unsubscribe();
        setPushSubscription(null);
        
        // Remove subscription from server
        await apiFetch('/api/push/unsubscribe', {
          method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token')
            ? { 'x-auth-token': localStorage.getItem('token') }
            : {}),
        },
          body: JSON.stringify({ subscription: pushSubscription }),
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
    }
  };

  const OfflineIndicator = () => (
    <div className={`offline-indicator ${!isOnline ? 'visible' : ''}`}>
      <span>📵 You're offline. Some features may be limited.</span>
    </div>
  );

  const PWAFeatures = () => (
    <div className="pwa-features">
      <h2>📱 Mobile App Features</h2>
      
      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">🏠</div>
          <h3>Home Screen Installation</h3>
          <p>Add VersusVerseVault to your device's home screen for quick access</p>
          {!isInstalled && installPrompt && (
            <button onClick={installApp} className="install-btn">
              📲 Install App
            </button>
          )}
          {isInstalled && (
            <div className="installed-badge">✅ Installed</div>
          )}
        </div>

        <div className="feature-card">
          <div className="feature-icon">🔔</div>
          <h3>Push Notifications</h3>
          <p>Get notified about fight results, new challenges, and messages</p>
          {notificationPermission === 'default' && (
            <button onClick={requestNotificationPermission} className="enable-notifications-btn">
              🔔 Enable Notifications
            </button>
          )}
          {notificationPermission === 'granted' && !pushSubscription && (
            <button onClick={subscribeToPushNotifications} className="subscribe-btn">
              🔔 Subscribe to Updates
            </button>
          )}
          {pushSubscription && (
            <div className="notification-status">
              <span className="enabled-badge">✅ Notifications Enabled</span>
              <button onClick={unsubscribeFromPushNotifications} className="unsubscribe-btn">
                🔕 Disable
              </button>
            </div>
          )}
          {notificationPermission === 'denied' && (
            <div className="denied-badge">❌ Notifications Blocked</div>
          )}
        </div>

        <div className="feature-card">
          <div className="feature-icon">📵</div>
          <h3>Offline Support</h3>
          <p>View cached fights and content even when offline</p>
          <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Fast Loading</h3>
          <p>Optimized for mobile with instant loading and smooth animations</p>
          <div className="performance-badge">⚡ Optimized</div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🔄</div>
          <h3>Auto Sync</h3>
          <p>Your votes, comments, and activity sync across all devices</p>
          <div className="sync-badge">🔄 Auto Sync</div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🌙</div>
          <h3>Dark Mode</h3>
          <p>Battery-friendly dark theme for better mobile experience</p>
          <div className="theme-badge">🌙 Dark Theme</div>
        </div>
      </div>
    </div>
  );

  const MobileOptimizations = () => (
    <div className="mobile-optimizations">
      <h2>📱 Mobile Experience</h2>
      
      <div className="optimization-list">
        <div className="optimization-item">
          <span className="optimization-icon">👆</span>
          <div className="optimization-content">
            <h4>Touch-Friendly Interface</h4>
            <p>Large tap targets and gesture support for easy navigation</p>
          </div>
        </div>

        <div className="optimization-item">
          <span className="optimization-icon">🔄</span>
          <div className="optimization-content">
            <h4>Pull-to-Refresh</h4>
            <p>Refresh content with a simple swipe down gesture</p>
          </div>
        </div>

        <div className="optimization-item">
          <span className="optimization-icon">📊</span>
          <div className="optimization-content">
            <h4>Data Saving</h4>
            <p>Optimized images and content caching to reduce data usage</p>
          </div>
        </div>

        <div className="optimization-item">
          <span className="optimization-icon">🔋</span>
          <div className="optimization-content">
            <h4>Battery Efficient</h4>
            <p>Smart background sync and reduced CPU usage</p>
          </div>
        </div>

        <div className="optimization-item">
          <span className="optimization-icon">📱</span>
          <div className="optimization-content">
            <h4>Responsive Design</h4>
            <p>Perfect layout on phones, tablets, and all screen sizes</p>
          </div>
        </div>

        <div className="optimization-item">
          <span className="optimization-icon">⚡</span>
          <div className="optimization-content">
            <h4>Instant Loading</h4>
            <p>Progressive loading and smart caching for instant access</p>
          </div>
        </div>
      </div>
    </div>
  );

  const NotificationSettings = () => (
    <div className="notification-settings">
      <h3>🔔 Notification Preferences</h3>
      
      <div className="notification-types">
        <div className="notification-type">
          <input type="checkbox" id="fight-results" defaultChecked />
          <label htmlFor="fight-results">
            <span className="notification-icon">🏆</span>
            Fight Results
          </label>
        </div>

        <div className="notification-type">
          <input type="checkbox" id="new-challenges" defaultChecked />
          <label htmlFor="new-challenges">
            <span className="notification-icon">⚔️</span>
            New Challenges
          </label>
        </div>

        <div className="notification-type">
          <input type="checkbox" id="messages" defaultChecked />
          <label htmlFor="messages">
            <span className="notification-icon">💬</span>
            Messages & Replies
          </label>
        </div>

        <div className="notification-type">
          <input type="checkbox" id="betting" defaultChecked />
          <label htmlFor="betting">
            <span className="notification-icon">🎰</span>
            Betting Reminders
          </label>
        </div>

        <div className="notification-type">
          <input type="checkbox" id="achievements" defaultChecked />
          <label htmlFor="achievements">
            <span className="notification-icon">🏅</span>
            Achievements
          </label>
        </div>

        <div className="notification-type">
          <input type="checkbox" id="daily-challenges" defaultChecked />
          <label htmlFor="daily-challenges">
            <span className="notification-icon">🎯</span>
            Daily Challenges
          </label>
        </div>
      </div>
    </div>
  );

  const PWAStats = () => (
    <div className="pwa-stats">
      <h3>📊 App Performance</h3>
      
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-number">&lt; 2s</span>
          <span className="stat-label">Load Time</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">95%</span>
          <span className="stat-label">Uptime</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">&lt; 5MB</span>
          <span className="stat-label">App Size</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">98</span>
          <span className="stat-label">Performance Score</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pwa-configuration">
      <OfflineIndicator />
      
      <div className="pwa-header">
        <h1>📱 Mobile App Experience</h1>
        <p>Transform VersusVerseVault into a native-like mobile app experience</p>
      </div>

      <PWAFeatures />
      <MobileOptimizations />
      <NotificationSettings />
      <PWAStats />

      <div className="pwa-footer">
        <div className="browser-support">
          <h4>🌐 Browser Support</h4>
          <div className="browser-list">
            <span className="browser-item">✅ Chrome</span>
            <span className="browser-item">✅ Firefox</span>
            <span className="browser-item">✅ Safari</span>
            <span className="browser-item">✅ Edge</span>
          </div>
        </div>

        <div className="platform-support">
          <h4>📱 Platform Support</h4>
          <div className="platform-list">
            <span className="platform-item">✅ Android</span>
            <span className="platform-item">✅ iOS</span>
            <span className="platform-item">✅ Windows</span>
            <span className="platform-item">✅ macOS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Service Worker registration utility
export const registerSW = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
};

// PWA utility functions
export const PWAUtils = {
  // Check if app is installed
  isInstalled: () => {
    return window.matchMedia('(display-mode: standalone)').matches;
  },

  // Check if device is online
  isOnline: () => {
    return navigator.onLine;
  },

  // Show notification
  showNotification: (title, options = {}) => {
    if (Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options
      });
    }
  },

  // Vibrate device (if supported)
  vibrate: (pattern = [200]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },

  // Check device orientation
  getOrientation: () => {
    return window.screen?.orientation?.type || 'unknown';
  },

  // Check if device is mobile
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Get device pixel ratio
  getPixelRatio: () => {
    return window.devicePixelRatio || 1;
  },

  // Cache management
  clearCache: async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  },

  // Storage usage
  getStorageUsage: async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }
};

export default PWAConfiguration;
