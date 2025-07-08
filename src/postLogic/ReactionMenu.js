import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './ReactionMenu.css';

const ReactionMenu = ({ onReactionSelect, onClose }) => {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState(null);

  const reactionCategories = [
    {
      key: 'controversial',
      label: t('controversial'),
      icon: '🤔',
      reactions: [
        { id: 'controversial1', icon: '🤔', name: 'Thinking' },
        { id: 'controversial2', icon: '😐', name: 'Neutral' },
        { id: 'controversial3', icon: '🤷', name: 'Shrug' }
      ]
    },
    {
      key: 'shocked',
      label: t('shocked'),
      icon: '😱',
      reactions: [
        { id: 'shocked1', icon: '😱', name: 'Shocked' },
        { id: 'shocked2', icon: '😨', name: 'Fearful' },
        { id: 'shocked3', icon: '😲', name: 'Astonished' }
      ]
    },
    {
      key: 'like',
      label: t('like'),
      icon: '👍',
      reactions: [
        { id: 'like1', icon: '👍', name: 'Thumbs Up' },
        { id: 'like2', icon: '👏', name: 'Clap' },
        { id: 'like3', icon: '🙌', name: 'Raised Hands' }
      ]
    },
    {
      key: 'love',
      label: t('love'),
      icon: '❤️',
      reactions: [
        { id: 'love1', icon: '❤️', name: 'Heart' },
        { id: 'love2', icon: '🥰', name: 'Smiling Heart' },
        { id: 'love3', icon: '💕', name: 'Two Hearts' }
      ]
    },
    {
      key: 'dislike',
      label: t('dislike'),
      icon: '👎',
      reactions: [
        { id: 'dislike1', icon: '👎', name: 'Thumbs Down' },
        { id: 'dislike2', icon: '😒', name: 'Unamused' },
        { id: 'dislike3', icon: '🤨', name: 'Raised Eyebrow' }
      ]
    },
    {
      key: 'hate',
      label: t('hate'),
      icon: '😠',
      reactions: [
        { id: 'hate1', icon: '😠', name: 'Angry' },
        { id: 'hate2', icon: '🤬', name: 'Cursing' },
        { id: 'hate3', icon: '💢', name: 'Anger Symbol' }
      ]
    },
    {
      key: 'goodJob',
      label: t('goodJob'),
      icon: '👌',
      reactions: [
        { id: 'goodJob1', icon: '👌', name: 'OK Hand' },
        { id: 'goodJob2', icon: '🎉', name: 'Party' },
        { id: 'goodJob3', icon: '🏆', name: 'Trophy' }
      ]
    }
  ];

  const handleReactionSelect = (reaction) => {
    onReactionSelect(reaction);
    onClose();
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  return (
    <div className="reaction-menu-overlay" onClick={onClose}>
      <div className="reaction-menu" onClick={(e) => e.stopPropagation()}>
        <div className="reaction-menu-header">
          <h3>{t('reactions')}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="reaction-categories">
          {reactionCategories.map(category => (
            <div key={category.key} className="reaction-category">
              <button
                className={`category-btn ${selectedCategory === category.key ? 'active' : ''}`}
                onClick={() => handleCategorySelect(category.key)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-label">{category.label}</span>
              </button>
              
              {selectedCategory === category.key && (
                <div className="reaction-options">
                  {category.reactions.map(reaction => (
                    <button
                      key={reaction.id}
                      className="reaction-option"
                      onClick={() => handleReactionSelect(reaction)}
                    >
                      <span className="reaction-icon">{reaction.icon}</span>
                      <span className="reaction-name">{reaction.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReactionMenu; 