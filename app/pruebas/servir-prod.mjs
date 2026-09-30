// Sirve el repositorio como lo servirá GitHub Pages: la carpeta del repo
// aparece en /pokemon-libre/. Así se prueba la app publicada, no solo la de
// desarrollo, con sus rutas, su base y su modo sin internet.
//   node pruebas/servir-prod.mjs [puerto]
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, extname, join } from 'node:path'

const puerto = Number(process.argv[2] || 8410)
const raiz = resolve(import.meta.dirname, '../..')
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  if (!url.startsWith('/pokemon-libre/')) { res.writeHead(url === '/pokemon-libre' ? 301 : 404, { Location: '/pokemon-libre/' }); return res.end() }
  let ruta = resolve(raiz, '.' + url.slice('/pokemon-libre'.length))
  if (!ruta.startsWith(raiz)) { res.writeHead(403); return res.end() }
  if (existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, 'index.html')
  if (!existsSync(ruta)) { res.writeHead(404); return res.end('no existe') }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
  createReadStream(ruta).pipe(res)
}).listen(puerto, '0.0.0.0', () => console.log(`Sirviendo en http://localhost:${puerto}/pokemon-libre/  (la nueva, en /nueva/)`))
