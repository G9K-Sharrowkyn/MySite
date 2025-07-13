import React, { useState, useEffect } from 'react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the install prompt
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          📱
        </div>
        <div className="pwa-install-text">
          <h3>Install BattleVote</h3>
          <p>Get the full app experience with offline support and push notifications!</p>
        </div>
        <div className="pwa-install-actions">
          <button 
            className="pwa-install-btn pwa-install-primary"
            onClick={handleInstallClick}
          >
            Install
          </button>
          <button 
            className="pwa-install-btn pwa-install-secondary"
            onClick={handleDismiss}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;