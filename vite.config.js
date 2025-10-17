import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change this to your repo name
export default defineConfig({
  plugins: [react()],
  base: '/',
})
