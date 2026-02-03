import React, { useEffect, useRef } from 'react';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const GoogleSignInButton = ({ onCredential, onError }) => {
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return undefined;
    }

    let cancelled = false;

    const handleCredential = (response) => {
      if (!response?.credential) {
        onError?.('Google did not return a valid credential.');
        return;
      }
      onCredential?.(response.credential);
    };

    const renderButton = () => {
      if (
        cancelled ||
        initializedRef.current ||
        !buttonRef.current ||
        !window.google?.accounts?.id
      ) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential
      });

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 360
      });

      initializedRef.current = true;
    };

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (window.google?.accounts?.id) {
      renderButton();
    } else if (existingScript) {
      existingScript.addEventListener('load', renderButton);
    } else {
      const script = document.createElement('script');
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', renderButton);
      script.addEventListener('error', () => {
        onError?.('Failed to load Google Sign-In script.');
      });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (existingScript) {
        existingScript.removeEventListener('load', renderButton);
      }
    };
  }, [onCredential, onError]);

  if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <div className="google-auth-block">
      <div className="auth-divider"><span>or</span></div>
      <div ref={buttonRef} className="google-signin-button" />
    </div>
  );
};

export default GoogleSignInButton;
