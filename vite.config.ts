import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: '/macau-bus/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000, // Increase limit for gov_data.json split chunk
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries
          'vendor-react': ['react', 'react-dom'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-axios': ['axios'],
          'gov-data': ['src/data/gov_data.json'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/macauweb': {
        target: 'https://bis.dsat.gov.mo:37812',
        changeOrigin: true,
        secure: false, // Ignore SSL issues
        rewrite: (path) => path,
        configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
                proxyReq.setHeader('Referer', 'https://bis.dsat.gov.mo:37812/macauweb/map.html');
                proxyReq.setHeader('Origin', 'https://bis.dsat.gov.mo:37812');
            });
        },
      },
      '/ddbus': {
        target: 'https://bis.dsat.gov.mo:37812',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
                proxyReq.setHeader('Referer', 'https://bis.dsat.gov.mo:37812/macauweb/map.html');
                proxyReq.setHeader('Origin', 'https://bis.dsat.gov.mo:37812');
            });
        },
      },
    },
  },
})
