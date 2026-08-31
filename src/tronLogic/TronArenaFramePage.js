import React, { useEffect, useRef, useState } from 'react';
import './TronArenaFramePage.css';

const MIN_GAME_HEIGHT = 620;

const TronArenaFramePage = () => {
  const iframeRef = useRef(null);
  const [gameHeight, setGameHeight] = useState(MIN_GAME_HEIGHT);

  useEffect(() => {
    const header = document.querySelector('.header');
    const iframe = iframeRef.current;
    const updateHeight = () => {
      const headerHeight = header?.getBoundingClientRect().height || 0;
      setGameHeight(Math.max(MIN_GAME_HEIGHT, window.innerHeight - headerHeight));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    const observer = typeof ResizeObserver === 'function' && header
      ? new ResizeObserver(updateHeight)
      : null;
    observer?.observe(header);
    return () => {
      window.removeEventListener('resize', updateHeight);
      observer?.disconnect();
      if (iframe) iframe.src = 'about:blank';
    };
  }, []);

  return (
    <main className="tron-frame-page" style={{ height: `${gameHeight}px` }}>
      <iframe
        ref={iframeRef}
        className="tron-game-frame"
        src="/tron-game?embedded=1"
        title="TRON: Neon Arena"
        allow="fullscreen"
      />
    </main>
  );
};

export default TronArenaFramePage;
