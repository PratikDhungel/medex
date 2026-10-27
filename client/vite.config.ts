/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Time-zone and slot logic shared with the server (Task 3)
      '@shared': path.resolve(import.meta.dirname, '../shared'),
    },
  },
  server: {
    // ../shared sits outside the client, so the dev server has to be allowed to serve it
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(import.meta.dirname, '../shared')] },
    // Forward API calls to the Express server in development
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    // Domain logic is pure TS; switch per file with `// @vitest-environment jsdom` if a test needs the DOM
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
