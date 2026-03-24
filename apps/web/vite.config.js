import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    sourcemap: true,
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
