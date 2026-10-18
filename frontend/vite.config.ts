import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * GitHub Pages has no SPA rewrites, so a deep link like /jobs/job_henderson
 * would 404. Pages serves 404.html for unknown paths; making it a copy of
 * index.html lets the router handle every route.
 */
function githubPagesSpaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of the custom domain (fieldcard.us), so no sub-path.
  base: '/',
  plugins: [react(), tailwindcss(), githubPagesSpaFallback()],
  // NEXT_PUBLIC_API_URL is the backend address; VITE_API_URL is accepted too.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
