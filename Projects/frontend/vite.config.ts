import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react(),
    nitro({
      routeRules: {
        '/api/**': { proxy: `${process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001'}/**` },
      },
    }),
  ],
})
