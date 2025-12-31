// Version check utility
export const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
export const BUILD_TIME = process.env.REACT_APP_BUILD_TIME || new Date().toISOString();

export const checkVersion = () => {
  const storedVersion = localStorage.getItem('app-build-time');
  
  if (!storedVersion) {
    localStorage.setItem('app-build-time', BUILD_TIME);
    return { needsUpdate: false };
  }
  
  if (storedVersion !== BUILD_TIME) {
    return { needsUpdate: true, oldVersion: storedVersion, newVersion: BUILD_TIME };
  }
  
  return { needsUpdate: false };
};

export const clearCache = () => {
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  // Clear service worker cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
  
  // Update build time
  localStorage.setItem('app-build-time', BUILD_TIME);
};
