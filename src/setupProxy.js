const { createProxyMiddleware } = require('http-proxy-middleware');

const backendTarget = 'http://localhost:5001';

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
    })
  );

  // Proxy for Socket.io
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxy
    })
  );
};
