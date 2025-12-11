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
      },
      '/ddbus': {
        target: 'https://bis.dsat.gov.mo:37812',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
})
