import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/verify-paystack': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/verify-paystack/, '/verifyPaystack'),
      },
      '/zoom-auth-start': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoom-auth-start/, '/zoomAuthStart'),
      },
      '/zoom-create-meeting': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoom-create-meeting/, '/zoomCreateMeeting'),
      },
      '/zoom-oauth-callback': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoom-oauth-callback/, '/zoomOAuthCallback'),
      },
    },
  },
})
