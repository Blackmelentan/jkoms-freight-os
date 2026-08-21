import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// JKOMS Global Ltd — Freight OS
// Local dev: npm run dev (defaults to http://localhost:5173)
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/logo/icon-navy-on-white.png'],
      manifest: {
        name: 'JKOMS Freight OS',
        short_name: 'JKOMS Freight',
        description: 'JKOMS Global Ltd — Freight & Logistics Management System',
        theme_color: '#002062',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/assets/logo/icon-navy-on-white.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/logo/icon-navy-on-white.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Runtime cache for Supabase REST calls so the scan queue can survive
        // brief connectivity drops in a warehouse/loading-bay environment.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true // exposes on LAN so a phone/handheld scanner on the same wifi can hit it
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
