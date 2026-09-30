// Recorrido de uso + capturas a tamaño de móvil, con el Chrome instalado.
//   node capturas.mjs [url-base]
// Cada comprobación imprime OK o FALLA: nada se da por bueno sin haberlo hecho.
import { chromium } from '@playwright/test'

const base = process.argv[2] || 'http://localhost:5173/'
const nav = await chromium.launch({ channel: 'chrome' })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
const consola = []
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(m.type() + ': ' + m.text()) })
p.on('pageerror', (e) => consola.push('EXCEPCIÓN: ' + e.message))
p.on('response', (r) => { if (r.status() >= 400) consola.push(`HTTP ${r.status()}: ${r.url()}`) })

let fallos = 0
const ok = (cond, texto) => { console.log((cond ? 'OK    ' : 'FALLA ') + texto); if (!cond) fallos++ }
const foto = async (nombre, espera = 900) => { await p.waitForTimeout(espera); await p.screenshot({ path: `capturas/${nombre}.png` }) }
const varCss = (sel, v) => p.$eval(sel, (el, v) => getComputedStyle(el).getPropertyValue(v).trim(), v)

// ---------- inicio ----------
await p.goto(base); await p.waitForSelector('.baldosa')
ok((await p.locator('.baldosa').count()) === 17, 'inicio: 12 Pokémon + 5 familias en inglés')
await foto('1-inicio-en')

await p.click('.lengua button >> nth=1')
await p.waitForTimeout(500)
const nJa = await p.locator('.baldosa').count()
ok(nJa >= 12, `inicio en japonés: ${nJa} baldosas, no las mismas cartas`)
await foto('2-inicio-ja')
await p.click('.lengua button >> nth=0')

// ---------- un Pokémon ----------
await p.locator('.baldosa', { hasText: 'Pikachu' }).first().click()
await p.waitForSelector('.celda')
ok(p.url().includes('#/pokemon/pikachu'), 'la dirección lleva #/pokemon/pikachu')
ok((await p.locator('.celda').count()) === 194, 'Pikachu en inglés: 194 celdas')
await foto('3-pikachu-en')

// marcar una carta con el círculo
const antes = await p.locator('.celda.mia').count()
await p.locator('.celda .check').first().click()
ok((await p.locator('.celda.mia').count()) === antes + 1, 'el círculo marca la carta (placa y borde en oro)')
await p.locator('.celda .check').first().click()
ok((await p.locator('.celda.mia').count()) === antes, 'y la desmarca')

// ---------- la ficha ----------
await p.locator('.celda .ver').nth(3).click()
await p.waitForSelector('.ficha')
await p.waitForTimeout(900)
ok(await p.locator('.ficha .card__front img').isVisible(), 'la ficha abre con la carta grande')
ok((await p.locator('.ficha h2').innerText()).length > 2, 'la ficha trae el nombre')
await foto('4-ficha', 700)

const c = await p.locator('.ficha .card__rotator').boundingBox()
await p.mouse.move(c.x + c.width * 0.3, c.y + c.height * 0.25)
await p.mouse.move(c.x + c.width * 0.75, c.y + c.height * 0.4, { steps: 10 })
await p.waitForTimeout(500)
const rx = await varCss('.ficha .card', '--rotate-x')
ok(rx !== '0deg' && rx !== '', `la carta se inclina con el dedo (--rotate-x = ${rx})`)
await foto('5-ficha-inclinada', 300)
await p.mouse.move(5, 5)

const nombre1 = await p.locator('.ficha h2').innerText()
const pos1 = await p.locator('.ficha .pos').innerText()
await p.click('.ficha .flecha.der'); await p.waitForTimeout(500)
const pos2 = await p.locator('.ficha .pos').innerText()
ok(pos1 !== pos2, `la flecha pasa a la siguiente (${pos1} → ${pos2})`)
await p.click('.ficha .flecha.izq'); await p.waitForTimeout(400)
ok((await p.locator('.ficha .pos').innerText()) === pos1, 'y la flecha izquierda vuelve')

await p.click('.ficha .tengo'); await p.waitForTimeout(250)
ok(await p.locator('.ficha .tengo.mia').count() === 1, '«Marcar que la tengo» la marca desde la ficha')
await p.click('.ficha .tengo')

await p.click('.ficha .cruz'); await p.waitForTimeout(800)
ok((await p.locator('.ficha').count()) === 0, 'la cruz cierra la ficha')

// ---------- expansiones y botón atrás ----------
await p.click('.barra button >> nth=1'); await p.waitForSelector('.expansiones, .baldosa')
ok(p.url().includes('#/exp'), 'la barra de abajo lleva a Expansiones')
await foto('6-expansiones-en')
await p.goBack(); await p.waitForTimeout(400)
ok(!p.url().includes('#/exp'), 'el botón atrás vuelve de Expansiones')

await p.goto(base + '#/set/base1'); await p.waitForSelector('.celda')
ok((await p.locator('.celda').count()) === 13, 'Base Set: sus 13 cartas de tus Pokémon')
const centro = await p.$eval('.celdas', (el) => getComputedStyle(el).justifyContent)
ok(centro === 'center', 'las celdas van centradas')

await p.goto(base + '#/exp'); await p.waitForSelector('.baldosa')
await p.click('.lengua button >> nth=1'); await p.waitForTimeout(600)
await foto('7-expansiones-ja')

console.log('\n' + (consola.length ? 'CONSOLA:\n' + [...new Set(consola)].join('\n') : 'consola limpia: sin errores ni 404'))
console.log(fallos ? `\n${fallos} COMPROBACIONES FALLAN` : '\ntodas las comprobaciones OK')
await nav.close()
process.exit(fallos ? 1 : 0)
