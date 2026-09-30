// Recorrido de uso completo a tamaño de móvil, con capturas.
//   node pruebas/uso.mjs [url-base]
// Cada comprobación imprime OK o FALLA: nada se da por bueno sin haberlo hecho.
import { chromium } from '@playwright/test'
import { promises as fs } from 'node:fs'
import { readFileSync } from 'node:fs'
// Los números salen del catálogo, no de la memoria: cuando entra una expansión nueva no hay que tocar la prueba.
const CAT = JSON.parse(readFileSync(new URL('../../data/catalogo.json', import.meta.url), 'utf8'))
const EN = (id) => CAT.cartas.filter((c) => !c.s.startsWith('ja-') && c.p.includes(id)).length
const EN_TODAS = CAT.cartas.filter((c) => !c.s.startsWith('ja-')).length

const base = process.argv[2] || 'http://localhost:5173/'
await fs.mkdir('capturas', { recursive: true })
const nav = await chromium.launch({ channel: 'chrome' })
const nuevo = (extra = {}) => nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true, ...extra })
let ctx = await nuevo()
const p = await ctx.newPage()
const consola = []
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(m.type() + ': ' + m.text()) })
p.on('pageerror', (e) => consola.push('EXCEPCIÓN: ' + e.message))
p.on('response', (r) => { if (r.status() >= 400) consola.push(`HTTP ${r.status()}: ${r.url()}`) })

let fallos = 0
const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); if (!c) fallos++ }
const foto = async (n, espera = 900) => { await p.waitForTimeout(espera); await p.screenshot({ path: `capturas/${n}.png` }) }
const varCss = (sel, v) => p.$eval(sel, (el, v) => getComputedStyle(el).getPropertyValue(v).trim(), v)
const guardado = () => p.evaluate(() => JSON.parse(localStorage.getItem('pokemon-libre') || 'null'))

/* ---------- inicio ---------- */
await p.goto(base); await p.waitForSelector('.baldosa')
ok((await p.locator('.baldosa').count()) === 17, 'inicio: 12 Pokémon + 5 familias en inglés')
await foto('1-inicio')
await p.click('.lengua button >> nth=1'); await p.waitForTimeout(500)
ok((await p.locator('.baldosa').count()) >= 12, 'inicio en japonés: otra colección, con sus propias baldosas')
await foto('2-inicio-ja')
await p.click('.lengua button >> nth=0')

/* ---------- un Pokémon, filtros y búsqueda ---------- */
await p.locator('.baldosa', { hasText: 'Pikachu' }).first().click()
await p.waitForSelector('.celda')
ok(p.url().includes('#/pokemon/pikachu'), 'la dirección lleva #/pokemon/pikachu')
ok((await p.locator('.celda').count()) === EN('pikachu'), `Pikachu en inglés: ${EN('pikachu')} celdas`)
await foto('3-pikachu')

await p.fill('input[type=search]', 'surfing')
await p.waitForTimeout(400)
const surf = await p.locator('.celda').count()
ok(surf > 0 && surf < 10, `la búsqueda «surfing» deja ${surf} cartas`)
await p.fill('input[type=search]', 'zzzzzz'); await p.waitForTimeout(300)
ok((await p.locator('.celda').count()) === 0 && (await p.locator('.vacio').count()) === 1, 'una búsqueda sin resultados lo dice, no deja la pantalla en blanco')
await p.fill('input[type=search]', '')

await p.locator('.celda .check').first().click()
await p.click('.chips button >> nth=2'); await p.waitForTimeout(400)
ok((await p.locator('.celda').count()) === 1, 'el filtro «Tengo» enseña solo la que marqué')
await p.click('.chips button >> nth=1'); await p.waitForTimeout(400)
ok((await p.locator('.celda').count()) === EN('pikachu') - 1, 'el filtro «Me faltan» enseña las otras')
await p.click('.chips button >> nth=0'); await p.waitForTimeout(300)
await p.locator('.celda .check').first().click()          // la desmarco

/* ---------- la ficha ---------- */
await p.locator('.celda .ver').nth(3).click()
await p.waitForSelector('.ficha'); await p.waitForTimeout(900)
ok(await p.locator('.ficha .card__front img').isVisible(), 'la ficha abre con la carta grande')
await foto('4-ficha', 500)
const c = await p.locator('.ficha .card__rotator').boundingBox()
await p.mouse.move(c.x + c.width * 0.3, c.y + c.height * 0.25)
await p.mouse.move(c.x + c.width * 0.75, c.y + c.height * 0.4, { steps: 10 })
await p.waitForTimeout(500)
const rx = await varCss('.ficha .card', '--rotate-x')
ok(rx !== '0deg' && rx !== '', `la carta se inclina con el dedo (--rotate-x = ${rx})`)
await p.mouse.move(5, 5)
const pos1 = await p.locator('.ficha .pos').innerText()
await p.click('.ficha .flecha.der'); await p.waitForTimeout(500)
ok(pos1 !== (await p.locator('.ficha .pos').innerText()), 'la flecha pasa a la siguiente')
await p.click('.ficha .flecha.izq'); await p.waitForTimeout(300)
await p.click('.ficha .cruz'); await p.waitForTimeout(800)
ok((await p.locator('.ficha').count()) === 0, 'la cruz cierra la ficha')

/* ---------- expansiones ---------- */
await p.click('.barra button >> nth=1'); await p.waitForSelector('.baldosa')
ok(p.url().includes('#/exp'), 'la barra lleva a Expansiones')
ok((await p.locator('.panel .cinta').count()) >= 5, 'expansiones agrupadas por serie, cada una con su cinta')
await foto('5-expansiones')
await p.goBack(); await p.waitForTimeout(300)
ok(!p.url().includes('#/exp'), 'el botón atrás vuelve de Expansiones')

/* ---------- me faltan ---------- */
await p.click('.barra button >> nth=2'); await p.waitForSelector('.resumen')
ok(p.url().includes('#/faltan'), 'la barra lleva a Me faltan')
const faltan = parseInt((await p.locator('.resumen .cifra b').innerText()).replace(/\D/g, ''), 10)
ok(faltan >= EN_TODAS - 70 && faltan <= EN_TODAS, `Me faltan cuenta las cartas en inglés: ${faltan}`)
ok((await p.locator('.celda').count()) <= 120, 'y las enseña por tandas, no todas de golpe')
await foto('6-faltan')
await p.click('.mas'); await p.waitForTimeout(500)
ok((await p.locator('.celda').count()) > 120, '«Ver más» añade otra tanda')
await p.click('.chips button >> nth=1'); await p.waitForTimeout(500)
ok((await p.locator('.celda').count()) <= EN('pikachu'), 'el filtro por Pokémon acota la lista')

/* ---------- ajustes ---------- */
await p.click('.barra button >> nth=3'); await p.waitForSelector('.ajustes')
ok(p.url().includes('#/ajustes'), 'la barra lleva a Ajustes')
await foto('7-ajustes')
await p.click('[data-tema="oscuro"]'); await p.waitForTimeout(500)
ok((await p.evaluate(() => document.documentElement.dataset.tema)) === 'oscuro', 'Oscuro se aplica al momento')
const fondoOsc = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
await foto('8-ajustes-oscuro', 300)
await p.goto(base + '#/'); await p.waitForSelector('.baldosa'); await foto('9-inicio-oscuro')
await p.goto(base + '#/ajustes'); await p.waitForSelector('.ajustes')
await p.click('[data-tema="claro"]'); await p.waitForTimeout(300)
ok((await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== fondoOsc, 'y Claro lo devuelve')
ok((await guardado()).ajustes.tema === 'claro', 'el tema elegido se guarda')

// preevoluciones fuera
await p.click('.interruptor'); await p.waitForTimeout(300)
await p.click('.barra button >> nth=0'); await p.waitForSelector('.baldosa')
ok((await p.locator('.baldosa').count()) === 12, 'sin preevoluciones: solo los 12 Pokémon')
await p.click('.barra button >> nth=3'); await p.waitForSelector('.ajustes'); await p.click('.interruptor')

// copia de seguridad y restaurar
await p.goto(base + '#/'); await p.waitForSelector('.baldosa')
await p.goto(base + '#/set/base1'); await p.waitForSelector('.celda')
await p.locator('.celda .check').first().click(); await p.waitForTimeout(500)
await p.goto(base + '#/ajustes'); await p.waitForSelector('.ajustes')
const [desc] = await Promise.all([p.waitForEvent('download'), p.click('[data-copia]')])
const copia = JSON.parse(await fs.readFile(await desc.path(), 'utf8'))
ok(copia.app === 'pokemon-libre' && Object.keys(copia.coleccion).length === 1, 'la copia de seguridad se descarga con la colección')
const rutaCopia = 'capturas/copia-prueba.json'
await fs.writeFile(rutaCopia, JSON.stringify({ ...copia, coleccion: { ...copia.coleccion, 'base1-58': { normal: 1 } } }))
await p.click('[data-borrar]'); await p.waitForSelector('.pregunta')
ok(await p.locator('.pregunta').isVisible(), 'borrar pide confirmación dentro de la página')
await foto('10-confirmar', 300)
await p.click('.pregunta .botones button >> nth=0'); await p.waitForTimeout(300)
ok((await p.locator('.pregunta').count()) === 0 && Object.keys((await guardado()).coleccion).length === 1, 'cancelar no borra nada')
const [selector] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-restaurar]')])
await selector.setFiles(rutaCopia)
await p.waitForSelector('.pregunta')
ok((await p.locator('.pregunta h2').innerText()).includes('2 cartas'), 'restaurar avisa de cuántas cartas trae el fichero')
await p.click('.pregunta .botones button >> nth=1'); await p.waitForTimeout(600)
ok(Object.keys((await guardado()).coleccion).length === 2, 'restaurar sustituye la colección por la del fichero')

console.log('\n' + (consola.length ? 'CONSOLA:\n' + [...new Set(consola)].join('\n') : 'consola limpia: sin errores ni 404'))
console.log(fallos ? `\n${fallos} COMPROBACIONES FALLAN` : '\ntodas las comprobaciones OK')
await nav.close()
process.exit(fallos ? 1 : 0)
