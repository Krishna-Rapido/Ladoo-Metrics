import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use '/' for Render.com or other dedicated hosting
  // Use '/internal_tools_v1/' for GitHub Pages
  base: process.env.GITHUB_PAGES === 'true' ? '/internal_tools_v1/' : '/',
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
