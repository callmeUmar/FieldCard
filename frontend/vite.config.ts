import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // VITE_API_URL is the Vite name; NEXT_PUBLIC_API_URL is accepted too.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
