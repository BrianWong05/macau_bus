import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
