import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws'
    },
    // Proxy all /api requests to the Express backend.
    // This eliminates ERR_CONNECTION_REFUSED when the backend port changes,
    // and removes the need to hardcode http://localhost:5000 in the frontend.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts'
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-maps'
          if (id.includes('socket.io-client')) return 'vendor-realtime'
          return 'vendor'
        }
      }
    }
  }
})
