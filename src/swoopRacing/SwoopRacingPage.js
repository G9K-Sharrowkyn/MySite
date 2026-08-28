import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../auth/AuthContext';
import './SwoopRacingPage.css';

const MIN_GAME_HEIGHT = 620;

export default function SwoopRacingPage() {
  const { user } = useContext(AuthContext);
  const iframeRef = useRef(null);
  const [gameHeight, setGameHeight] = useState(MIN_GAME_HEIGHT);

  const sendSession = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'geekfights:swoop-session',
        user: user
          ? {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              role: user.role
            }
          : null
      },
      window.location.origin
    );
  }, [user]);

  useEffect(() => {
    const header = document.querySelector('.header');
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
    };
  }, []);

  useEffect(() => {
    sendSession();
  }, [sendSession]);

  return (
    <main className="swoop-racing-page" style={{ height: `${gameHeight}px` }}>
      <iframe
        ref={iframeRef}
        className="swoop-racing-frame"
        src="/swoop-racing/index.html"
        title="Swoop Racing"
        allow="fullscreen"
        onLoad={sendSession}
      />
    </main>
  );
}
