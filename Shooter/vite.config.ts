import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/shooter/',
  build: {
    outDir: path.resolve(import.meta.dirname, '../public/shooter'),
    emptyOutDir: true,
  },
  plugins: [react()],
})
