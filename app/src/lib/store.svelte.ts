/* ===================================================================
   Estado de la app: el catálogo, el idioma y las marcas.

   Aquí NO hay diseño. Este fichero solo sabe de cartas. Es lo que la
   fase 1 sustituirá por la lectura de las marcas reales del móvil; en
   el prototipo las marcas se guardan aparte, en su propia clave, para
   no tocar nunca lo que ya tienes marcado en la app vieja.
   =================================================================== */

export type Set = { n: string; rel?: string; tot?: number; o?: number; ja?: boolean; cod?: string }
export type Carta = {
  id: string; n: string; p: string[]; s: string; num: string
  r: string; v: string[]; ill: string; l?: 'ja'; ni?: string
  tc_id?: number; tc_slug?: string; tp_id?: number
  j?: { e?: string; de?: string; ps?: number; t?: string[] }
}
export type Pokemon = { id: string; nombre: string; tipo: string; principal?: boolean }
export type Idioma = 'en' | 'ja'

const CLAVE = 'pl2-prototipo-marcas'

export const app = $state({
  listo: false,
  sets: {} as Record<string, Set>,
  cartas: [] as Carta[],
  pokemon: [] as Pokemon[],
  idioma: 'en' as Idioma,
  marcas: {} as Record<string, true>,
})

export async function cargar() {
  const [cat, man] = await Promise.all([
    fetch('/data/catalogo.json').then((r) => r.json()),
    fetch('/data/manifiesto.json').then((r) => r.json()),
  ])
  app.sets = cat.sets
  app.cartas = cat.cartas
  app.pokemon = man.pokemon
  try { app.marcas = JSON.parse(localStorage.getItem(CLAVE) || '{}') } catch { app.marcas = {} }
  app.listo = true
}

export function alternar(id: string) {
  if (app.marcas[id]) delete app.marcas[id]
  else app.marcas[id] = true
  try { localStorage.setItem(CLAVE, JSON.stringify(app.marcas)) } catch { /* sin almacenamiento */ }
}

/** Las cartas del idioma elegido. Inglés y japonés son dos colecciones. */
export const delIdioma = (idioma: Idioma = app.idioma) =>
  app.cartas.filter((c) => (idioma === 'ja') === (c.l === 'ja'))

const numero = (n: string) => parseInt(String(n).replace(/\D/g, ''), 10) || 0

export function ordenar(cartas: Carta[]) {
  return [...cartas].sort((a, b) =>
    (app.sets[a.s]?.o ?? 9999) - (app.sets[b.s]?.o ?? 9999) ||
    numero(a.num) - numero(b.num) || a.num.localeCompare(b.num))
}

export const cartasDe = (pokemonId: string) => ordenar(delIdioma().filter((c) => c.p.includes(pokemonId)))

export function porSet(cartas: Carta[]) {
  const grupos: { id: string; set: Set; cartas: Carta[] }[] = []
  for (const c of ordenar(cartas)) {
    let g = grupos[grupos.length - 1]
    if (!g || g.id !== c.s) { g = { id: c.s, set: app.sets[c.s] ?? { n: c.s }, cartas: [] }; grupos.push(g) }
    g.cartas.push(c)
  }
  return grupos
}

export const tengo = (id: string) => !!app.marcas[id]
export const progreso = (cartas: Carta[]) => {
  const t = cartas.filter((c) => tengo(c.id)).length
  return { tengo: t, total: cartas.length, parte: cartas.length ? t / cartas.length : 0 }
}

/** El número como está impreso en la carta: lo que resuelve el catálogo
    (promos sin total, subcolecciones con letras) o, si no, número/total. */
export function numeroImpreso(c: Carta): string {
  if (c.ni) return c.ni
  const s = app.sets[c.s]
  if (!s || !s.tot) return String(c.num)
  const num = String(c.num)
  let tot = String(s.tot)
  if (/^0\d/.test(num) && tot.length < num.length) tot = tot.padStart(num.length, '0')
  return `${num}/${tot}`
}

/** Los logos que existen de verdad, para no pedir los que no hay. */
export const logos = $state({ ids: new Set<string>(), series: {} as Record<string, { serie: string; slug: string; s: number; p: number }> })
fetch('/logos/lista.json').then((r) => r.json()).then((l: string[]) => { logos.ids = new Set(l) }).catch(() => {})
fetch('/logos/series.json').then((r) => r.json()).then((datos: Record<string, { serie: string; slug: string; s: number; p: number }>) => { logos.series = datos }).catch(() => {})

/** Qué efecto de foil lleva. Aproximado en el prototipo: la fase 3 lo afina
    con las 23 variantes por rareza. */
export function foil(c: Carta): string {
  const r = (c.r || '').toLowerCase()
  if (/rainbow|hyper/.test(r)) return 'rare rainbow'
  if (/secret|illustration|special|gold|shiny|ultra|double/.test(r)) return 'rare secret'
  if (/holo/.test(r) || c.v.includes('holo')) return 'rare holo'
  return 'common'
}

export const ETAPA: Record<string, string> = {
  Basic: 'Básica', Stage1: 'Fase 1', Stage2: 'Fase 2', 'Stage 1': 'Fase 1', 'Stage 2': 'Fase 2',
}
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const mesYAnio = (rel?: string) => {
  if (!rel) return ''
  const [a, m] = rel.split('-')
  return MES[Number(m) - 1] ? `${MES[Number(m) - 1]} de ${a}` : a
}
