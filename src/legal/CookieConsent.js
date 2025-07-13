import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './CookieConsent.css';

const CookieConsent = () => {
  const [showConsent, setShowConsent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true
    analytics: false,
    marketing: false,
    functional: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Check if user has already made a choice
    const consentGiven = localStorage.getItem('cookie-consent');
    if (!consentGiven) {
      setShowConsent(true);
    }
  }, []);

  const handleAcceptAll = async () => {
    setIsLoading(true);
    const allPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    
    try {
      await saveConsent(allPreferences);
      setPreferences(allPreferences);
      setShowConsent(false);
      localStorage.setItem('cookie-consent', 'all');
    } catch (error) {
      console.error('Error saving consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptNecessary = async () => {
    setIsLoading(true);
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };
    
    try {
      await saveConsent(necessaryOnly);
      setPreferences(necessaryOnly);
      setShowConsent(false);
      localStorage.setItem('cookie-consent', 'necessary');
    } catch (error) {
      console.error('Error saving consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustom = async () => {
    setIsLoading(true);
    try {
      await saveConsent(preferences);
      setShowConsent(false);
      setShowSettings(false);
      localStorage.setItem('cookie-consent', 'custom');
      localStorage.setItem('cookie-preferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving custom consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConsent = async (consentPreferences) => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    const consentData = {
      userId: userId || 'anonymous',
      preferences: consentPreferences,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ipAddress: 'client-side', // Will be set by server
      gdprCompliant: true,
      ccpaCompliant: true
    };

    if (token) {
      await axios.post('/api/legal/consent', consentData, {
        headers: { 'x-auth-token': token }
      });
    } else {
      // Store locally for anonymous users
      localStorage.setItem('anonymous-consent', JSON.stringify(consentData));
    }
  };

  const handlePreferenceChange = (category, value) => {
    if (category === 'necessary') return; // Cannot disable necessary cookies
    
    setPreferences(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const getCookieDescription = (category) => {
    switch (category) {
      case 'necessary':
        return 'Essential cookies required for the website to function properly. These cannot be disabled.';
      case 'analytics':
        return 'Help us understand how visitors interact with our website by collecting and reporting information anonymously.';
      case 'marketing':
        return 'Used to track visitors across websites to display relevant and engaging advertisements.';
      case 'functional':
        return 'Enable enhanced functionality and personalization such as remembering your preferences and settings.';
      default:
        return '';
    }
  };

  const CookieSettings = () => (
    <div className="cookie-settings">
      <div className="settings-header">
        <h3>🍪 Cookie Preferences</h3>
        <p>Manage your cookie preferences to control how we use your data.</p>
      </div>

      <div className="cookie-categories">
        {Object.entries(preferences).map(([category, enabled]) => (
          <div key={category} className="cookie-category">
            <div className="category-header">
              <div className="category-info">
                <h4>{category.charAt(0).toUpperCase() + category.slice(1)} Cookies</h4>
                <p>{getCookieDescription(category)}</p>
              </div>
              <div className="category-toggle">
                <input
                  type="checkbox"
                  id={`cookie-${category}`}
                  checked={enabled}
                  onChange={(e) => handlePreferenceChange(category, e.target.checked)}
                  disabled={category === 'necessary'}
                />
                <label htmlFor={`cookie-${category}`} className="toggle-label">
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            {category === 'necessary' && (
              <div className="necessary-notice">
                <span className="notice-icon">ℹ️</span>
                <span>These cookies are essential and cannot be disabled.</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="settings-actions">
        <button 
          className="save-btn"
          onClick={handleSaveCustom}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </button>
        <button 
          className="cancel-btn"
          onClick={() => setShowSettings(false)}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>

      <div className="legal-info">
        <p>
          <strong>GDPR Compliance:</strong> You have the right to withdraw consent at any time. 
          Your data will be processed according to our{' '}
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <p>
          <strong>CCPA Compliance:</strong> California residents have additional rights regarding 
          their personal information. See our{' '}
          <a href="/privacy-policy#ccpa" target="_blank" rel="noopener noreferrer">CCPA Notice</a>.
        </p>
      </div>
    </div>
  );

  if (!showConsent && !showSettings) return null;

  return (
    <div className="cookie-consent-overlay">
      <div className="cookie-consent-modal">
        {!showSettings ? (
          <>
            <div className="consent-header">
              <div className="cookie-icon">🍪</div>
              <h2>Cookie Consent</h2>
              <p>
                We use cookies to enhance your experience, analyze site traffic, and personalize content. 
                By continuing to use our site, you consent to our use of cookies.
              </p>
            </div>

            <div className="consent-actions">
              <button 
                className="accept-all-btn"
                onClick={handleAcceptAll}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Accept All Cookies'}
              </button>
              <button 
                className="necessary-btn"
                onClick={handleAcceptNecessary}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Necessary Only'}
              </button>
              <button 
                className="customize-btn"
                onClick={() => setShowSettings(true)}
                disabled={isLoading}
              >
                Customize Preferences
              </button>
            </div>

            <div className="consent-footer">
              <p>
                Learn more about our{' '}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                {' '}and{' '}
                <a href="/cookie-policy" target="_blank" rel="noopener noreferrer">Cookie Policy</a>.
              </p>
            </div>
          </>
        ) : (
          <CookieSettings />
        )}
      </div>
    </div>
  );
};

export default CookieConsent;