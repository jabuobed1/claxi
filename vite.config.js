import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Mermaid and its close ecosystem first
          if (
            id.includes('mermaid') ||
            id.includes('@mermaid-js') ||
            id.includes('dagre') ||
            id.includes('elkjs') ||
            id.includes('khroma') ||
            id.includes('layout-base') ||
            id.includes('cytoscape') ||
            id.includes('/d3') ||
            id.includes('d3-')
          ) {
            return 'mermaid'
          }

          // Excalidraw and related drawing libs
          if (
            id.includes('@excalidraw') ||
            id.includes('roughjs')
          ) {
            return 'excalidraw'
          }

          // Firebase
          if (
            id.includes('firebase/')
          ) {
            return 'firebase'
          }

          // PDF / export
          if (
            id.includes('pdfjs-dist') ||
            id.includes('jspdf') ||
            id.includes('html2canvas')
          ) {
            return 'pdf'
          }

          // Image helpers
          if (
            id.includes('pica') ||
            id.includes('image-blob-reduce')
          ) {
            return 'image-tools'
          }

          // Math rendering
          if (
            id.includes('katex')
          ) {
            return 'katex'
          }

          // UI libs
          if (
            id.includes('lucide-react') ||
            id.includes('@radix-ui')
          ) {
            return 'ui'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/ice-config': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ice-config/, '/getIceConfig'),
      },
      '/verify-paystack': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/verify-paystack/, '/verifyPaystack'),
      },
      '/finalize-session-billing': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/finalize-session-billing/, '/finalizeSessionBilling'),
      },
    },
  },
})