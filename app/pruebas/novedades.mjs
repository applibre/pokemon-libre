// El aviso de novedades dentro de la app: aparece, «Añadir» mete las cartas,
// «Descartar» las aparta, se puede volver a preguntar, y todo sobrevive a recargar.
//   node pruebas/novedades.mjs [url-base]      (necesita data/novedades.json con algo pendiente)
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const base = process.argv[2] || 'http://localhost:5173/'
let NOV = { cartas: [] }
try { NOV = JSON.parse(readFileSync(new URL('../../data/novedades.json', import.meta.url), 'utf8')) } catch { /* sin fichero: nada pendiente */ }
const CAT = JSON.parse(readFileSync(new URL('../../data/catalogo.json', import.meta.url), 'utf8'))
const conocidas = new Set(CAT.cartas.map((c) => c.id))
const pend = NOV.cartas.filter((c) => !conocidas.has(c.id))
const porSet = [...new Set(pend.map((c) => c.s))]
if (!porSet.length) { console.log('No hay novedades pendientes que probar.'); process.exit(0) }

const nav = await chromium.launch({ channel: 'chrome' })
let fallos = 0
const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); if (!c) fallos++ }
const errores = []
const nuevo = async () => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(base); await p.waitForSelector('.baldosa')
  return { ctx, p }
}
const celdasDelSet = async (p, sid) => {
  const ja = !!(NOV.sets?.[sid]?.ja ?? CAT.sets[sid]?.ja)
  await p.goto(base + '#/set/' + sid); await p.waitForTimeout(500)
  await p.click('.lengua button >> nth=' + (ja ? 1 : 0)); await p.waitForTimeout(500)
  return p.locator('.celda').count()
}

// 1 · aparece el aviso, uno por expansión
let { ctx, p } = await nuevo()
await p.waitForSelector('.novedad', { timeout: 8000 }).catch(() => {})
ok((await p.locator('.novedad').count()) === porSet.length, `el aviso sale al abrir: ${porSet.length} expansión(es) con cartas nuevas`)
const primero = porSet[0]
const cuantas = pend.filter((c) => c.s === primero).length
const nombre = NOV.sets?.[primero]?.n ?? CAT.sets[primero]?.n
ok((await p.locator('.novedad').first().textContent()).includes(nombre), `el aviso dice qué expansión es: «${nombre}»`)
await p.screenshot({ path: 'capturas/novedades-aviso.png' })
ok((await celdasDelSet(p, primero)) === 0, 'antes de aprobar, esas cartas NO están en la colección')

// 2 · Añadir
await p.goto(base); await p.waitForSelector('.novedad')
await p.locator('.novedad').first().locator('[data-novedad-si]').click(); await p.waitForTimeout(600)
ok((await p.locator('.novedad').count()) === porSet.length - 1, 'tras «Añadir», ese aviso desaparece')
ok((await celdasDelSet(p, primero)) === cuantas, `y sus ${cuantas} cartas ya están en la colección`)
await p.reload(); await p.waitForTimeout(1500)
ok((await p.locator('.celda').count()) === cuantas, 'y siguen ahí al recargar')
await p.goto(base); await p.waitForSelector('.baldosa'); await p.waitForTimeout(500)
ok((await p.locator('.novedad').count()) === porSet.length - 1, 'el aviso aprobado no vuelve a salir')
await ctx.close()

// 3 · Descartar y volver a preguntar
;({ ctx, p } = await nuevo())
await p.waitForSelector('.novedad')
await p.locator('.novedad').first().locator('[data-novedad-no]').click(); await p.waitForTimeout(600)
ok((await p.locator('.novedad').count()) === porSet.length - 1, 'tras «Descartar», ese aviso desaparece')
ok((await celdasDelSet(p, primero)) === 0, 'y sus cartas no entran')
await p.goto(base + '#/ajustes'); await p.waitForSelector('[data-recuperar]')
await p.click('[data-recuperar]'); await p.waitForTimeout(500)
await p.goto(base); await p.waitForSelector('.baldosa'); await p.waitForTimeout(600)
ok((await p.locator('.novedad').count()) === porSet.length, '«Volver a preguntarme» en Ajustes lo trae de vuelta')
await ctx.close()

console.log(errores.length ? 'ERRORES: ' + errores.join(' | ') : 'sin errores de JavaScript')
if (errores.length) fallos++
console.log(fallos ? `${fallos} COMPROBACIONES FALLAN` : 'novedades OK')
await nav.close()
process.exit(fallos ? 1 : 0)
