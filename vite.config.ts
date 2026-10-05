import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')

          if (!normalizedId.includes('/node_modules/')) {
            return undefined
          }

          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'radix-vendor'
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/')
          ) {
            return 'react-vendor'
          }

          if (
            normalizedId.includes('/node_modules/dexie/') ||
            normalizedId.includes('/node_modules/zod/') ||
            normalizedId.includes('/node_modules/zustand/')
          ) {
            return 'data-vendor'
          }

          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'icons-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
