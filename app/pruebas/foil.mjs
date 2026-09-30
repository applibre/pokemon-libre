// Una carta de cada clase de foil, inclinada, para mirarlas a ojo.
//   node pruebas/foil.mjs   ->  capturas/foil/*.png (y un resumen del reparto)
// Un efecto que deja la carta ilegible es peor que ninguno: aquí se ve.
import { mantener } from './gestos.mjs'
import { chromium } from '@playwright/test'
import { promises as fs } from 'node:fs'

const base = process.argv[2] || 'http://localhost:5173/'
await fs.mkdir('capturas/foil', { recursive: true })
for (const f of await fs.readdir('capturas/foil')) await fs.unlink('capturas/foil/' + f)

const nav = await chromium.launch({ channel: 'chrome' })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))
await p.goto(base); await p.waitForSelector('.baldosa')

// clasificar TODO el catálogo con la misma función que usa la app
const reparto = await p.evaluate(async () => {
  const { foil } = await import('/src/lib/foil.ts')
  const cat = await (await fetch('/data/catalogo.json')).json()
  const por = {}
  for (const c of cat.cartas) {
    const f = foil(c)
    const clave = f.rarity + (f.gallery ? ' · galería' : '') + (c.l === 'ja' ? ' · JP' : ' · EN')
    ;(por[clave] ??= []).push(c.id)
  }
  return por
})
const claves = Object.keys(reparto).sort()
console.log('Reparto de efectos en todas las cartas:')
for (const k of claves) console.log(`  ${String(reparto[k].length).padStart(4)}  ${k}`)

const muestras = []
for (const k of claves) {
  if (k.startsWith('common')) continue
  // una del medio del grupo, no la primera, para no repetir siempre la misma era
  muestras.push([k, reparto[k][Math.floor(reparto[k].length / 2)]])
}

let hechas = 0
for (const [clave, id] of muestras) {
  const set = id.slice(0, id.lastIndexOf('-'))
  const carta = await p.evaluate(async (id) => (await (await fetch('/data/catalogo.json')).json()).cartas.find((c) => c.id === id), id)
  // la carta japonesa solo se ve con el interruptor en JP
  await p.click('.lengua button >> nth=' + (carta.l === 'ja' ? 1 : 0))
  await p.goto(base + '#/set/' + carta.s); await p.waitForSelector('.celda')
  const celda = p.locator(`[data-carta="${id}"] .ver`)
  if (!(await celda.count())) { console.log('  (sin celda para', id, ')'); continue }
  await mantener(p, celda)
  await p.waitForSelector('.ficha'); await p.waitForTimeout(900)
  const c = await p.locator('.ficha .card__rotator').boundingBox()
  await p.mouse.move(c.x + c.width * 0.3, c.y + c.height * 0.3)
  await p.mouse.move(c.x + c.width * 0.68, c.y + c.height * 0.42, { steps: 8 })
  await p.waitForTimeout(650)
  await p.locator('.ficha .carta').screenshot({ path: `capturas/foil/${String(++hechas).padStart(2, '0')}-${clave.replace(/[^a-z0-9]+/gi, '_')}.png` })
  await p.click('.ficha .cruz'); await p.waitForTimeout(400)
}
console.log(errores.length ? 'ERRORES: ' + errores.join(' | ') : `\n${hechas} capturas sin errores de JavaScript`)
await nav.close()
process.exit(errores.length ? 1 : 0)
