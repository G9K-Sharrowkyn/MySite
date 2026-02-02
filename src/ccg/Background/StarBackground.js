import React, { useState, useEffect } from 'react';
import './StarBackground.css';

const generateBoxShadows = (count, maxWidth, maxHeight) => {
  let shadows = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * maxWidth);
    const y = Math.floor(Math.random() * maxHeight);
    shadows.push(`${x}px ${y}px #FFF`);
  }
  return shadows.join(', ');
};

const generateColoredStars = (count, maxWidth, maxHeight, colors) => {
  let shadows = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * maxWidth);
    const y = Math.floor(Math.random() * maxHeight);
    const color = colors[Math.floor(Math.random() * colors.length)];
    shadows.push(`${x}px ${y}px ${color}`);
  }
  return shadows.join(', ');
};

const StarBackground = () => {
  const [smallStars] = useState(() => generateBoxShadows(2100, window.innerWidth, window.innerHeight));
  const [mediumStars] = useState(() => generateBoxShadows(500, window.innerWidth, window.innerHeight));
  const [bigStars] = useState(() => generateBoxShadows(500, window.innerWidth, window.innerHeight));
  
  // Kolorowe gwiazdy sci-fi
  const [neonStars] = useState(() => generateColoredStars(300, window.innerWidth, window.innerHeight, [
    '#00ffff', '#ff0080', '#8000ff', '#00ff41', '#ff8000'
  ]));
  
  // Pulsujące gwiazdy
  const [pulsingStars] = useState(() => generateColoredStars(150, window.innerWidth, window.innerHeight, [
    '#00ffff', '#ff0080', '#8000ff'
  ]));

  return (
    <div className="stars-background">
      {/* Podstawowe gwiazdy */}
      <div id="stars" style={{ boxShadow: smallStars }}></div>
      <div id="stars2" style={{ boxShadow: mediumStars }}></div>
      <div id="stars3" style={{ boxShadow: bigStars }}></div>
      
      {/* Neonowe gwiazdy sci-fi */}
      <div 
        className="neon-stars" 
        style={{ 
          boxShadow: neonStars,
          animation: 'twinkle 4s ease-in-out infinite alternate'
        }}
      ></div>
      
      {/* Pulsujące gwiazdy */}
      <div 
        className="pulsing-stars" 
        style={{ 
          boxShadow: pulsingStars,
          animation: 'starPulse 3s ease-in-out infinite'
        }}
      ></div>
      
      {/* Nebule kosmiczne */}
      <div className="nebula nebula-1"></div>
      <div className="nebula nebula-2"></div>
      <div className="nebula nebula-3"></div>
      
      {/* Efekty świetlne */}
      <div className="cosmic-glow cosmic-glow-1"></div>
      <div className="cosmic-glow cosmic-glow-2"></div>
      <div className="cosmic-glow cosmic-glow-3"></div>
      
      {/* Tytuł gry */}
      <div id="title">
        <span className="game-title">
          <span className="title-line-1">PROTEUS NEBULE</span>
          <br />
          <span className="title-line-2">BATTLE CARD GAME</span>
        </span>
      </div>
      
      {/* Efekt skanowania globalnego */}
      <div className="global-scan-effect"></div>
      
      {/* Cząsteczki energii */}
      <div className="energy-particles">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
        <div className="particle particle-5"></div>
      </div>
    </div>
  );
};

export default StarBackground;
