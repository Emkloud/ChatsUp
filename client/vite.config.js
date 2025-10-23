import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  server: {
    // bind to all interfaces so localhost resolves reliably (IPv4 and IPv6)
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4001'
    }
  }
})