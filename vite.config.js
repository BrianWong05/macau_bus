import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/bresws': {
        target: 'http://www.dsat.gov.mo',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
})
