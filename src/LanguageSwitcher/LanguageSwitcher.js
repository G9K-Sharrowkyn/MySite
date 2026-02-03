import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
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
    <>
      {/* Dark Mode Toggle */}
      <button
        className="theme-toggle after-ccg after-ccg-controls"
        onClick={toggleDarkMode}
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      {/* Language Switcher */}
      <div className="language-switcher after-ccg after-ccg-controls">
        <button
          className="language-button"
          onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          title="Change Language"
        >
          <img
            {...getOptimizedImageProps(currentLang?.flag, { size: 24 })}
            className="flag"
            alt={currentLang?.name}
          />
          <span className="language-code">{currentLang?.name || 'English'}</span>
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
                <img
                  {...getOptimizedImageProps(language.flag, { size: 24 })}
                  className="flag"
                  alt={language.name}
                />
                <span className="language-name">{language.name}</span>
                {currentLanguage === language.code && <span className="check">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default LanguageSwitcher;
