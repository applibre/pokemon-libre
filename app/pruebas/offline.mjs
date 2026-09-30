// El modo sin internet, en la app publicada.
//   node pruebas/offline.mjs [url-base]
// Se abre la app con conexión, se espera a que se instale, se corta la red y
// se comprueba que sigue enseñando las cartas y guardando lo que marcas.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const TOTAL = JSON.parse(readFileSync(new URL('../../data/catalogo.json', import.meta.url), 'utf8')).cartas.length

const base = process.argv[2] || 'http://localhost:8410/pokemon-libre/nueva/'
const nav = await chromium.launch({ channel: 'chrome' })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
let fallos = 0
const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); if (!c) fallos++ }
const errores = []
p.on('pageerror', (e) => errores.push(e.message))

await p.goto(base); await p.waitForSelector('.baldosa')
// las imágenes de la pantalla se guardan en cuanto se piden: se abre un Pokémon
await p.locator('.baldosa', { hasText: 'Gengar' }).first().click(); await p.waitForSelector('.celda')
await p.waitForTimeout(1500)

const sw = await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready
  return { activo: !!reg.active, alcance: reg.scope }
})
ok(sw.activo, `el service worker está activo (${sw.alcance})`)
// una segunda visita: ya con el service worker al mando, las cartas que se ven se guardan
await p.reload(); await p.waitForSelector('.celda'); await p.waitForTimeout(2500)
const caches = await p.evaluate(async () => Promise.all((await window.caches.keys()).map(async (k) => [k, (await (await window.caches.open(k)).keys()).length])))
console.log('       cachés:', caches.map(([k, n]) => `${k}=${n}`).join(' · '))
ok(caches.some(([k, n]) => /precache/.test(k) && n > 100), 'la app entera está en la caché (código, estilos, logos, texturas)')
ok(caches.some(([k, n]) => /precache/.test(k) && n > 100), 'el catálogo viaja en la instalación, no depende de haberlo pedido después')

// ---- sin red ----
await ctx.setOffline(true)
await p.goto(base + '#/pokemon/gengar'); await p.waitForTimeout(400)
await p.reload(); await p.waitForSelector('.celda', { timeout: 15000 })
ok(true, 'sin conexión la app abre y enseña las cartas de Gengar')
const cargadas = await p.$$eval('.celda img', (im) => im.filter((i) => i.complete && i.naturalWidth > 0).length)
ok(cargadas >= 5, `y sus imágenes, ya vistas, salen sin red (${cargadas} cargadas)`)

await p.locator('.celda .check').first().click(); await p.waitForTimeout(600)
const g = await p.evaluate(() => JSON.parse(localStorage.getItem('pokemon-libre') || 'null'))
ok(Object.keys(g?.coleccion || {}).length === 1, 'marcar una carta sin conexión se guarda')
await p.click('.barra button >> nth=1'); await p.waitForSelector('.baldosa')
ok(true, 'y se puede navegar a Expansiones sin red')
await p.click('.barra button >> nth=3'); await p.waitForSelector('.ajustes')
ok(true, 'y a Ajustes')

await ctx.setOffline(false)
// el botón «Guardar todas las cartas»: baja unas cuantas y el contador sube
await p.click('.barra button >> nth=3'); await p.waitForSelector('[data-guardar-todo]')
const antes = await p.textContent('.fila:has-text("guardadas") .v')
await p.click('[data-guardar-todo]')
await p.waitForSelector('[data-parar]', { timeout: 10000 })
await p.waitForSelector('[data-guardar-todo]', { timeout: 90000 }); await p.waitForTimeout(2500)
const despues = await p.textContent('.fila:has-text("guardadas") .v')
const n = (t) => Number(t.split(' ')[0])
ok(n(despues) > n(antes) + 20 && n(despues) === TOTAL, `«Guardar todas» descarga las cartas (${antes.trim()} → ${despues.trim()})`)
console.log(errores.length ? '\nERRORES: ' + errores.join(' | ') : '\nsin errores de JavaScript')
console.log(fallos ? `${fallos} COMPROBACIONES FALLAN` : 'modo sin internet OK')
await nav.close()
process.exit(fallos ? 1 : 0)
