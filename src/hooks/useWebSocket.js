import { useEffect, useRef, useState } from 'react';

const useWebSocket = (url, options = {}) => {
  const [socket, setSocket] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [readyState, setReadyState] = useState(0);
  const [error, setError] = useState(null);
  const messageQueue = useRef([]);

  useEffect(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      setReadyState(1);
      setError(null);
      // Send queued messages
      while (messageQueue.current.length > 0) {
        const message = messageQueue.current.shift();
        ws.send(JSON.stringify(message));
      }
      if (options.onOpen) options.onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        if (options.onMessage) options.onMessage(data);
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onclose = () => {
      setReadyState(3);
      if (options.onClose) options.onClose();
    };

    ws.onerror = (err) => {
      setError(err);
      if (options.onError) options.onError(err);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [url, options]);

  const sendMessage = (message) => {
    if (readyState === 1) {
      socket.send(JSON.stringify(message));
    } else {
      messageQueue.current.push(message);
    }
  };

  return {
    socket,
    lastMessage,
    readyState,
    error,
    sendMessage
  };
};

export default useWebSocket;
