// Los gestos de una carta, como los hace un dedo: un toque es rápido; abrir la
// ficha pide mantener la carta pulsada.
export async function mantener(p, loc, ms = 700) {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  const b = await loc.boundingBox()
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await p.mouse.down()
  await p.waitForTimeout(ms)
  await p.mouse.up()
}
