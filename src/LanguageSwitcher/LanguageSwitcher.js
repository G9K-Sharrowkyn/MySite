import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { currentLanguage, changeLanguage, isDarkMode, toggleDarkMode } = useLanguage();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const languages = [
    { code: 'pl', name: 'Polski', flag: '/flags/pl.svg' },
    { code: 'en', name: 'English', flag: '/flags/eng.png' },
    { code: 'es', name: 'Español', flag: '/flags/spa.svg' }
  ];

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    setShowLanguageMenu(false);
  };

  return (
    <div className="header-controls">
      {/* Dark Mode Toggle */}
      <button 
        className="theme-toggle"
        onClick={toggleDarkMode}
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      {/* Language Switcher */}
      <div className="language-switcher">
        <button 
          className="language-button"
          onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          title="Change Language"
        >
          <img className="flag" src={currentLang?.flag} alt={currentLang?.name} />
          <span className="dropdown-arrow">▼</span>
        </button>

        {showLanguageMenu && (
          <div className="language-menu">
            {languages.map(language => (
              <button
                key={language.code}
                className={`language-option ${currentLanguage === language.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(language.code)}
              >
                <img className="flag" src={language.flag} alt={language.name} />
                <span className="language-name">{language.name}</span>
                {currentLanguage === language.code && <span className="check">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSwitcher;