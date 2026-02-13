import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use '/' for Render.com or other dedicated hosting
  // Use '/internal_tools_v1/' for GitHub Pages
  base: process.env.GITHUB_PAGES === 'true' ? '/internal_tools_v1/' : '/',
  server: {
    // Allows the server to respond to requests from any host (not recommended for security reasons)
    // allowedHosts: true, 

    // Or, provide an array of specific allowed hostnames
    allowedHosts: [
      '*',
      'https://exhaust-jobs-color-greatly.trycloudflare.com ',
      'https://inns-weights-clause-pencil.trycloudflare.com',
      '192.168.1.100',
      'localhost:5173',
      'localhost:8001'
    ],
    // You may also need to set the 'host' option to true or '0.0.0.0' 
    // to listen on all network interfaces if accessing from a different machine or a cloud environment
    // host: true, 
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
