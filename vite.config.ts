import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; the Pages workflow sets
  // VITE_BASE, while local dev/preview/e2e keep the default '/'.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
