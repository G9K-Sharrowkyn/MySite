import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../auth/AuthContext';
import { LanguageContext } from '../i18n/LanguageContext';
import './VsStudioPage.css';

const MIN_STUDIO_HEIGHT = 620;

export default function VsStudioPage({ onImmersiveChange = () => {} }) {
  const { user } = useContext(AuthContext) || {};
  const { currentLanguage = 'en' } = useContext(LanguageContext) || {};
  const iframeRef = useRef(null);
  const [immersive, setImmersive] = useState(false);
  const [studioHeight, setStudioHeight] = useState(MIN_STUDIO_HEIGHT);
  const sendStudioContext = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'vvv-studio-access',
        role: user?.role || 'user',
        language: currentLanguage === 'pl' ? 'pl' : 'en',
      },
      window.location.origin,
    );
  }, [currentLanguage, user?.role]);

  useEffect(() => {
    const header = document.querySelector('.header');
    const updateHeight = () => {
      const headerHeight = header?.getBoundingClientRect().height || 0;
      setStudioHeight(Math.max(MIN_STUDIO_HEIGHT, window.innerHeight - headerHeight));
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
    sendStudioContext();
  }, [sendStudioContext]);

  useEffect(() => {
    const handleStudioMessage = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow
      ) {
        return;
      }

      if (event.data?.type === 'vvv-studio-ready') {
        sendStudioContext();
        return;
      }

      if (event.data?.type !== 'vvv-studio-darkseid-mode') return;

      const active = event.data.active === true;
      setImmersive(active);
      onImmersiveChange(active);
    };

    window.addEventListener('message', handleStudioMessage);
    return () => {
      window.removeEventListener('message', handleStudioMessage);
      onImmersiveChange(false);
    };
  }, [onImmersiveChange, sendStudioContext]);

  useEffect(() => {
    if (!immersive) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'vvv-studio-exit-darkseid' },
        window.location.origin,
      );
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [immersive]);

  return (
    <main
      className={`vs-studio-page${immersive ? ' vs-studio-page--immersive' : ''}`}
      style={{ height: immersive ? undefined : `${studioHeight}px` }}
    >
      <iframe
        ref={iframeRef}
        className="vs-studio-frame"
        src="/apps/vs-studio/index.html?v=20260919-darkseid-3"
        title="VS Graphic Studio"
        allow="fullscreen; clipboard-read; clipboard-write"
        onLoad={sendStudioContext}
      />
    </main>
  );
}
