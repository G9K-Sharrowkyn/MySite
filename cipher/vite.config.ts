import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cipher/',
  css: { postcss: { plugins: [] } },
  server: { host: '127.0.0.1', port: 4176, strictPort: true },
  preview: { host: '127.0.0.1', port: 4176, strictPort: true },
});
