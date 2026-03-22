import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // Actualiza la app automáticamente si subes cambios
      includeAssets: ['vite.svg'], // Archivos estáticos
      manifest: {
        name: 'MaquiTrack - Gestor de Mantenimiento',
        short_name: 'MaquiTrack',
        description: 'Control de mantenimiento de maquinaria y plantas.',
        theme_color: '#2563eb', // El azul de nuestros botones
        background_color: '#f8fafc', // El color de fondo de nuestra app
        display: 'standalone', // Esto oculta la barra de direcciones del navegador
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})