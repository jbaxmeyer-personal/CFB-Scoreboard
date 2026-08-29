import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/CFB-Scoreboard/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves in main.tsx (via virtual:pwa-register)
      // so we can force frequent update checks — the auto-injected script
      // only registers once with no update polling at all, which is why a
      // new deploy could sit undetected behind an already-installed SW.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/CFB-Scoreboard/',
        name: 'Slate — College Football TV Guide',
        short_name: 'Slate',
        description: 'A dark-themed college football TV viewing guide: kickoff times in your timezone, network badges, and a live scoreboard.',
        start_url: '/CFB-Scoreboard/',
        scope: '/CFB-Scoreboard/',
        display: 'standalone',
        background_color: '#0b0f14',
        theme_color: '#0b0f14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Runtime data (ESPN scoreboard) should never be served stale-first from
        // the SW cache; the app relies on React Query for its own caching.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
