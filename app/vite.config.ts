import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, extname } from 'node:path'

/* Los datos (catálogo e imágenes de las cartas) viven en ../data y NO se
   copian: en desarrollo se sirven desde allí tal cual, en /data/. Así la
   app nueva lee exactamente lo mismo que la vieja y no hay dos copias que
   se desincronicen. */
const TIPOS: Record<string, string> = {
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
}
function datos(): Plugin {
  const raiz = resolve(__dirname, '../data')
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
  plugins: [svelte(), tailwindcss(), datos()],
  server: { host: true, port: 5173 },
})
