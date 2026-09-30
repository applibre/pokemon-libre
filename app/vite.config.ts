import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'

/* Dónde vive la app al publicarla. En desarrollo, en la raíz.
     VITE_BASE   la carpeta de la app        (p. ej. /pokemon-libre/nueva/)
     VITE_DATOS  la carpeta de las cartas    (p. ej. /pokemon-libre/)
   Son distintas mientras la nueva convive con la vieja; se igualan al sustituirla. */
const BASE = process.env.VITE_BASE || '/'
const DATOS = process.env.VITE_DATOS || BASE
// la versión del catálogo: si cambia, el móvil descarga el nuevo
const VERSION = (() => {
  try { return JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/manifiesto.json'), 'utf8')).version as string }
  catch { return 'sin-version' }
})()

/* Los datos (catálogo e imágenes de las cartas) viven en ../data y NO se
   copian: en desarrollo se sirven desde allí tal cual, en /data/. Así la
   app nueva lee exactamente lo mismo que la vieja y no hay dos copias que
   se desincronicen. */
const TIPOS: Record<string, string> = {
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
}
function datos(): Plugin {
  const raiz = resolve(import.meta.dirname, '../data')
  return {
    name: 'servir-datos',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const ruta = resolve(raiz, decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\//, ''))
        if (!ruta.startsWith(raiz) || !existsSync(ruta) || !statSync(ruta).isFile()) return next()
        res.setHeader('Content-Type', TIPOS[extname(ruta)] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-store')
        createReadStream(ruta).pipe(res)
      })
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    svelte(),
    tailwindcss(),
    datos(),
    VitePWA({
      // se actualiza sola: una versión vieja guardada en el móvil fue justo lo
      // que nos dio problemas con la app anterior
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'iconos/apple-touch-icon.png'],
      manifest: {
        name: 'Pokémon Libre · tu colección de cartas',
        short_name: 'Pokémon Libre',
        description: 'Todas las cartas de tus Pokémon, en inglés y en japonés. Marca las que tienes y descubre las que te faltan. Sin cuenta y sin anuncios.',
        lang: 'es',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#5aaee0',
        theme_color: '#5aaee0',
        categories: ['utilities', 'lifestyle'],
        icons: [
          { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2,png}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        /* El catálogo va en la INSTALACIÓN del service worker, no como caché de
           ejecución: en la primera visita el service worker aún no controla la
           página y no vería esa petición, y sin catálogo la app sin internet
           abriría vacía. Con la versión como revisión, un catálogo nuevo se
           descarga solo. */
        additionalManifestEntries: [
          { url: `${DATOS}data/catalogo.json`, revision: VERSION },
          { url: `${DATOS}data/manifiesto.json`, revision: VERSION },
        ],
        runtimeCaching: [
          // las novedades: siempre se pregunta a la red primero, para enterarse
          // de la actualización de la semana; sin red, la última que se vio
          {
            urlPattern: /\/data\/novedades\.json/,
            handler: 'NetworkFirst',
            options: { cacheName: 'pl2-novedades', networkTimeoutSeconds: 6, cacheableResponse: { statuses: [200] } },
          },
          // las cartas: una vez vistas, se quedan. 3.566 ficheros, ~60 MB
          {
            urlPattern: /\/data\/cartas\//,      // una RegExp llana: una función con variables no viaja al service worker
            handler: 'CacheFirst',
            options: { cacheName: 'pl2-cartas', expiration: { maxEntries: 4000 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
})
