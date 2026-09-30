// Construye la app y la deja en la raíz del repositorio, lista para publicar.
//   node construir.mjs
// Los datos (cartas y catálogo) no se copian: ya viven en /pokemon-libre/data/.
// Solo se sustituye lo que es de la app (index.html, assets, sw.js…), nunca
// data/, app/, scripts/ ni tests/.
import { execFileSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const REPO = resolve(import.meta.dirname, '..')
const BASE = '/pokemon-libre/'
const DIST = join(import.meta.dirname, 'dist')

console.log(`Construyendo · base ${BASE}`)
execFileSync('npx', ['vite', 'build'], {
  stdio: 'inherit', shell: true, cwd: import.meta.dirname,
  env: { ...process.env, VITE_BASE: BASE, VITE_DATOS: BASE },
})

// lo que la construcción anterior dejó en la raíz: se quita para que no sobre nada
const DE_LA_APP = ['assets', 'holo', 'logos', 'iconos', 'index.html', 'sw.js', 'registerSW.js',
  'manifest.webmanifest', 'favicon.svg', 'icons.svg', 'fondo.svg', 'fondo-oscuro.svg']
for (const f of readdirSync(REPO)) {
  if (DE_LA_APP.includes(f) || /^workbox-.*\.js$/.test(f)) rmSync(join(REPO, f), { recursive: true, force: true })
}
cpSync(DIST, REPO, { recursive: true })

const peso = (d) => readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? peso(join(d, e.name)) : statSync(join(d, e.name)).size), 0)
console.log(`\nListo en ${REPO} · ${(peso(DIST) / 1024 / 1024).toFixed(1)} MB de app`)
if (!existsSync(join(REPO, 'data', 'catalogo.json'))) console.error('¡Ojo! No hay data/catalogo.json')
