import React, { useState } from 'react';
import cardsSpecifics from '../mechanics/CardsSpecifics';

// Component to handle card image loading with fallback
const CardImage = ({ cardName, cardType }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [allImagesFailed, setAllImagesFailed] = useState(false);

  // All possible image paths to try
  const possiblePaths = [
    // Try with process.env.PUBLIC_URL first
    `${process.env.PUBLIC_URL}/assets/cards/${cardName}.png`,
    `${process.env.PUBLIC_URL}/assets/cards/${cardName}.jpg`,
    `${process.env.PUBLIC_URL}/assets/cards2/${cardName}.png`,
    `${process.env.PUBLIC_URL}/assets/cards2/${cardName}.jpg`,
    // Try relative paths
    `/assets/cards/${cardName}.png`,
    `/assets/cards/${cardName}.jpg`,
    `/assets/cards2/${cardName}.png`,
    `/assets/cards2/${cardName}.jpg`,
    // Try with encoding for special characters
    `${process.env.PUBLIC_URL}/assets/cards/${encodeURIComponent(cardName)}.png`,
    `${process.env.PUBLIC_URL}/assets/cards/${encodeURIComponent(cardName)}.jpg`,
  ];

  const handleImageError = () => {
    console.log(`Failed to load image: ${possiblePaths[currentImageIndex]} for card: ${cardName}`);
    const nextIndex = currentImageIndex + 1;
    if (nextIndex < possiblePaths.length) {
      setCurrentImageIndex(nextIndex);
      setImageLoaded(false);
    } else {
      console.log(`All image paths failed for card: ${cardName}`);
      setAllImagesFailed(true);
    }
  };

  const handleImageLoad = () => {
    console.log(`Successfully loaded image: ${possiblePaths[currentImageIndex]} for card: ${cardName}`);
    setImageLoaded(true);
  };

  // If all images failed to load, show fallback
  if (allImagesFailed || !cardName) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 relative">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-gradient-to-br from-transparent via-white to-transparent transform rotate-45 scale-150"></div>
        </div>
        
        <div className="relative z-10 text-center px-1">
          <span className="text-xs text-white font-bold leading-tight block">
            {cardName?.replace(/_/g, ' ').substring(0, 20)}
          </span>
          
          {/* Card type indicator */}
          {cardType && cardType.length > 0 && (
            <div className="mt-1">
              <span className="text-xs text-yellow-300 font-semibold">
                {cardType[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      <img 
        src={possiblePaths[currentImageIndex]} 
        alt={cardName}
        className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </>
  );
};

const Card = ({ 
  card, 
  isSelected = false, 
  onClick, 
  size = 'normal', 
  showStats = false, 
  className = '',
  disabled = false,
  enableHoverZoom = true,
  animationState = '', // 'throw', 'deploy', 'attack', 'effect', 'draw', 'destroy', 'shimmer', 'glow', 'pulse'
  onAnimationEnd,
  draggable = false,
  onDragStart,
  onDragEnd
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState(animationState);
  const details = cardsSpecifics.find(c => c.name === card.name) || {};
  
  const sizeClasses = {
    tiny: 'w-8 h-12',
    small: 'w-12 h-16',
    normal: 'w-16 h-24 sm:w-20 sm:h-28',
    large: 'w-20 h-28 sm:w-24 sm:h-32',
    huge: 'w-28 h-40 sm:w-32 sm:h-44'
  };

  const handleClick = (e) => {
    if (disabled) return;
    if (onClick) {
      e.stopPropagation();
      onClick(card);
    }
  };

  const handleMouseEnter = () => {
    if (enableHoverZoom && !disabled) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleAnimationEnd = () => {
    setCurrentAnimation('');
    if (onAnimationEnd) {
      onAnimationEnd();
    }
  };

  // Aktualizuj animację gdy się zmieni
  React.useEffect(() => {
    setCurrentAnimation(animationState);
  }, [animationState]);

  const getAnimationClass = () => {
    switch (currentAnimation) {
      case 'throw': return 'card-throw';
      case 'deploy': return 'card-deploy';
      case 'attack': return 'card-attack';
      case 'effect': return 'card-effect';
      case 'draw': return 'card-draw';
      case 'destroy': return 'card-destroy';
      case 'shimmer': return 'card-shimmer';
      case 'glow': return 'card-glow';
      case 'pulse': return 'card-pulse';
      case 'selected': return 'card-selected';
      default: return '';
    }
  };

  const handleDragStart = (e) => {
    if (!draggable || disabled) {
      e.preventDefault();
      return;
    }
    
    setIsDragging(true);
    setIsHovered(false);
    
    // Ustaw dane karty do przeniesienia
    e.dataTransfer.setData('application/json', JSON.stringify(card));
    e.dataTransfer.effectAllowed = 'move';
    
    // Ustaw obraz drag
    const dragImage = e.target.cloneNode(true);
    dragImage.style.transform = 'rotate(5deg) scale(1.1)';
    dragImage.style.opacity = '0.8';
    e.dataTransfer.setDragImage(dragImage, 50, 70);
    
    if (onDragStart) {
      onDragStart(card, e);
    }
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd(card, e);
    }
  };

  return (
    <>
      <div 
        className={`
          ${sizeClasses[size]} 
          ${className}
          relative cursor-pointer transition-all duration-300 transform-gpu
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
          ${isSelected ? 'animate-selected scale-110 ring-2 ring-cyan-400 shadow-2xl z-20 pulse-glow' : 'hover:shadow-xl'}
          ${isHovered && enableHoverZoom && !disabled ? 'scale-[8] z-50' : ''}
          ${isDragging ? 'opacity-50 rotate-12' : ''}
          ${getAnimationClass()}
        `}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onAnimationEnd={handleAnimationEnd}
        draggable={draggable && !disabled}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Holograficzna ramka karty */}
        <div className="w-full h-full relative overflow-hidden">
          {/* Główna ramka sci-fi */}
          <div className="w-full h-full bg-gradient-to-b from-space-blue to-space-dark rounded-lg border-2 border-cyan-400/50 shadow-lg overflow-hidden relative energy-border">
            {/* Holograficzne tło */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-purple-400/5 to-pink-400/5"></div>
            
            {/* Efekt skanowania */}
            <div className="absolute inset-0 scan-lines opacity-30"></div>
            
            {/* Card Image */}
            <CardImage 
              cardName={card.name}
              cardType={details.type}
            />
            
            {/* Neonowe narożniki technologiczne */}
            <div className="tech-corners absolute inset-0"></div>
            
            {/* Card Stats Overlay - Neonowe */}
            {showStats && (
              <>
                {/* Command Cost - Neonowy niebieski */}
                {details.commandCost !== undefined && details.commandCost >= 0 && (
                  <div className="absolute top-1 left-1 w-6 h-6 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full flex items-center justify-center text-xs font-bold text-cyan-400 border-2 border-cyan-400 shadow-md pulse-glow">
                    <span className="font-mono">{details.commandCost}</span>
                  </div>
                )}
                
                {/* Attack Value - Neonowy czerwony */}
                {details.attack !== undefined && details.attack >= 0 && (
                  <div className="absolute bottom-1 left-1 w-6 h-6 bg-gradient-to-br from-pink-400/20 to-red-600/20 rounded-full flex items-center justify-center text-xs font-bold text-pink-400 border-2 border-pink-400 shadow-md pulse-glow">
                    <span className="font-mono">{details.attack}</span>
                  </div>
                )}
                
                {/* Defense Value - Neonowy zielony */}
                {details.defense !== undefined && details.defense >= 0 && (
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 border-2 border-green-400 shadow-md pulse-glow">
                    <span className="font-mono">{details.defense}</span>
                  </div>
                )}
                
                {/* Special indicators - Neonowy żółty */}
                {details.type && details.type.includes('Shipyard') && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full border border-yellow-400 shadow-md pulse-glow">
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-yellow-400 font-bold">⚓</span>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Holograficzny overlay */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-transparent to-cyan-400/10 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            
            {/* Efekt migotania hologramu */}
            <div className="absolute inset-0 flicker-effect opacity-20 pointer-events-none bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          </div>
        </div>
      </div>

      {/* Enlarged Card Preview on Hover - Holograficzny */}
      {isHovered && enableHoverZoom && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="w-64 h-96 transform scale-100 transition-all duration-200 animate-in fade-in zoom-in-95">
            {/* Holograficzna ramka powiększonej karty */}
            <div className="w-full h-full relative overflow-hidden">
              <div className="w-full h-full bg-gradient-to-b from-space-blue to-space-dark rounded-xl border-4 border-cyan-400 shadow-2xl overflow-hidden relative modular-frame">
                {/* Holograficzne tło */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-purple-400/10 to-pink-400/10"></div>
                
                {/* Efekt danych w tle */}
                <div className="data-stream opacity-50"></div>
                
                {/* Large Card Image */}
                <CardImage 
                  cardName={card.name}
                  cardType={details.type}
                />
                
                {/* Large Card Stats - Neonowe */}
                {showStats && (
                  <>
                    {/* Command Cost */}
                    {details.commandCost !== undefined && details.commandCost >= 0 && (
                      <div className="absolute top-3 left-3 w-12 h-12 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full flex items-center justify-center text-xl font-bold text-cyan-400 border-4 border-cyan-400 shadow-lg pulse-glow">
                        <span className="font-mono">{details.commandCost}</span>
                      </div>
                    )}
                    
                    {/* Attack Value */}
                    {details.attack !== undefined && details.attack >= 0 && (
                      <div className="absolute bottom-3 left-3 w-12 h-12 bg-gradient-to-br from-pink-400/20 to-red-600/20 rounded-full flex items-center justify-center text-xl font-bold text-pink-400 border-4 border-pink-400 shadow-lg pulse-glow">
                        <span className="font-mono">{details.attack}</span>
                      </div>
                    )}
                    
                    {/* Defense Value */}
                    {details.defense !== undefined && details.defense >= 0 && (
                      <div className="absolute bottom-3 right-3 w-12 h-12 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-full flex items-center justify-center text-xl font-bold text-green-400 border-4 border-green-400 shadow-lg pulse-glow">
                        <span className="font-mono">{details.defense}</span>
                      </div>
                    )}
                    
                    {/* Special indicators */}
                    {details.type && details.type.includes('Shipyard') && (
                      <div className="absolute top-3 right-3 w-8 h-8 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full border-2 border-yellow-400 shadow-lg pulse-glow">
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg text-yellow-400 font-bold">⚓</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {/* Card Name and Description - Sci-Fi Style */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-space-dark/70 to-transparent p-4">
                  <h3 className="text-cyan-400 font-bold text-lg mb-1 font-mono flicker-effect">
                    {card.name.replace(/_/g, ' ').toUpperCase()}
                  </h3>
                  {details.type && (
                    <p className="text-yellow-400 text-sm mb-2 font-mono">
                      [{details.type.join(', ').toUpperCase()}]
                    </p>
                  )}
                  {details.description && (
                    <p className="text-green-400 text-sm font-mono">
                      {details.description}
                    </p>
                  )}
                </div>
                
                {/* Holograficzny efekt świetlny */}
                <div className="absolute inset-0 rounded-xl bg-cyan-400/20 pulse-glow"></div>
                
                {/* Linie skanujące */}
                <div className="scan-lines opacity-60"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Card;