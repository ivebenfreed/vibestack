// Static Vite server configuration
// Ports are deterministic - no generation needed

export const dynamicServerConfig = {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8787',
      secure: false,
      changeOrigin: true,
      ws: true,
      configure: (proxy, options) => {
        // Ensure cookies are forwarded for WebSocket connections
        proxy.on('proxyReqWs', (proxyReq, req, socket) => {
          if (req.headers.cookie) {
            proxyReq.setHeader('Cookie', req.headers.cookie);
          }
        });
      }
    }
  }
};