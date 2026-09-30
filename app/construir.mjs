// Construye la app y la deja lista para publicar.
//   node construir.mjs nueva     -> ../nueva/    (convive con la vieja, en /pokemon-libre/nueva/)
//   node construir.mjs raiz      -> ../dist-raiz/ (sustituye a la vieja, en /pokemon-libre/)
// Los datos (cartas y catálogo) no se copian: ya viven en /pokemon-libre/data/.
import { execFileSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const modo = process.argv[2] || 'nueva'
const RAIZ = 'pokemon-libre'
const conf = {
  nueva: { base: `/${RAIZ}/nueva/`, datos: `/${RAIZ}/`, salida: resolve(import.meta.dirname, '../nueva') },
  raiz: { base: `/${RAIZ}/`, datos: `/${RAIZ}/`, salida: resolve(import.meta.dirname, '../dist-raiz') },
}[modo]
if (!conf) { console.error('modo desconocido: ' + modo); process.exit(1) }

console.log(`Construyendo «${modo}» · base ${conf.base} · datos ${conf.datos}`)
execFileSync('npx', ['vite', 'build'], {
  stdio: 'inherit', shell: true, cwd: import.meta.dirname,
  env: { ...process.env, VITE_BASE: conf.base, VITE_DATOS: conf.datos },
})

if (existsSync(conf.salida)) rmSync(conf.salida, { recursive: true, force: true })
cpSync(join(import.meta.dirname, 'dist'), conf.salida, { recursive: true })

const peso = (d) => readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? peso(join(d, e.name)) : statSync(join(d, e.name)).size), 0)
console.log(`\nListo en ${conf.salida} · ${(peso(conf.salida) / 1024 / 1024).toFixed(1)} MB`)
