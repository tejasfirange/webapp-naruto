import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/webapp-naruto/', // <-- Replace with your actual GitHub repo name

})
