/* ===================================================================
   Estado de la app: el catálogo, el idioma y tu colección.

   Aquí NO hay diseño: este fichero solo sabe de cartas. Lo que cambia
   (las marcas, los ajustes) pasa siempre por cambiar(), que lo guarda con
   un respiro: marcar diez cartas seguidas escribe una vez, no diez.
   =================================================================== */
import * as almacen from './almacen'
import type { Datos, Idioma, Tema } from './almacen'

export type { Datos, Idioma, Tema }
export type Set = { n: string; rel?: string; tot?: number; o?: number; ja?: boolean; cod?: string }
export type Carta = {
  id: string; n: string; p: string[]; s: string; num: string
  r: string; v: string[]; ill: string; l?: 'ja'; ni?: string
  eur?: number; usd?: number
  tc_id?: number; tc_slug?: string; tp_id?: number
  j?: { e?: string; de?: string; ps?: number; t?: string[] }
}
export type Novedades = { generado?: string; cartas: Carta[]; sets?: Record<string, Set>; orden?: Record<string, number> }
export type Pokemon = { id: string; nombre: string; tipo: string; principal?: boolean }

const numero = (n: string) => parseInt(String(n).replace(/\D/g, ''), 10) || 0

class Tienda {
  listo = $state(false)
  // el catálogo es grande y no cambia: sin reactividad profunda
  sets = $state.raw<Record<string, Set>>({})
  cartas = $state.raw<Carta[]>([])
  pokemon = $state.raw<Pokemon[]>([])
  man = $state.raw<{ version?: string; cartas?: number; sets?: number; generado?: string }>({})
  datos = $state<Datos>(almacen.leer())
  /* El catálogo publicado y, aparte, las novedades que el buscador semanal
     dejó preparadas (data/novedades.json). Una novedad solo entra en la
     colección cuando tú la apruebas en la app; lo decidido se guarda en
     ajustes.novedades { idDeCarta: 1 (añadida) | 0 (descartada) }. */
  base = $state.raw<{ sets: Record<string, Set>; cartas: Carta[] }>({ sets: {}, cartas: [] })
  novedad = $state.raw<Novedades | null>(null)
  // sube cada vez que decides una novedad: el aviso se entera al momento
  private decisiones = $state(0)

  private pendiente: ReturnType<typeof setTimeout> | null = null

  /** Inglés y japonés son dos colecciones. 'todo' venía de la app anterior. */
  get idioma(): Idioma { return this.datos.ajustes.idioma === 'ja' ? 'ja' : 'en' }
  set idioma(v: Idioma) { this.cambiar((d) => { d.ajustes.idioma = v }) }

  get tema(): Tema { return this.datos.ajustes.tema }

  async cargar(base = '') {
    const [cat, man] = await Promise.all([
      fetch(`${base}data/catalogo.json`).then((r) => r.json()),
      fetch(`${base}data/manifiesto.json`).then((r) => r.json()),
    ])
    this.base = { sets: cat.sets, cartas: cat.cartas }
    // las novedades son opcionales: si no hay fichero o no se lee, la app sigue igual
    try {
      const r = await fetch(`${base}data/novedades.json`, { cache: 'no-cache' })
      const n = r.ok ? await r.json() : null
      this.novedad = n && Array.isArray(n.cartas) ? n : null
    } catch { this.novedad = null }
    this.aplicar()
    this.pokemon = man.pokemon
    this.man = man
    if (!this.datos.creado) this.cambiar((d) => { d.creado = new Date().toISOString().slice(0, 10) })
    this.listo = true
  }

  private get decididas(): Record<string, number> {
    void this.decisiones
    return (this.datos.ajustes.novedades as Record<string, number>) || {}
  }

  /** El catálogo que se ve: el publicado más las novedades que aprobaste. */
  aplicar() {
    const n = this.novedad
    const conocidas = new Set(this.base.cartas.map((c) => c.id))
    const si = n ? n.cartas.filter((c) => !conocidas.has(c.id) && this.decididas[c.id] === 1) : []
    if (!si.length) { this.sets = this.base.sets; this.cartas = this.base.cartas; return }
    const sets: Record<string, Set> = {}
    for (const [id, s] of Object.entries({ ...this.base.sets, ...(n!.sets || {}) })) {
      sets[id] = { ...s, o: n!.orden?.[id] ?? s.o }
    }
    this.sets = sets
    this.cartas = [...this.base.cartas, ...si]
  }

  /** Las novedades que aún no has decidido, agrupadas por expansión. */
  get pendientes(): { id: string; set: Set; cartas: Carta[] }[] {
    const n = this.novedad
    if (!n) return []
    const conocidas = new Set(this.base.cartas.map((c) => c.id))
    const grupos = new Map<string, Carta[]>()
    for (const c of n.cartas) {
      if (conocidas.has(c.id) || c.id in this.decididas) continue
      grupos.set(c.s, [...(grupos.get(c.s) || []), c])
    }
    return [...grupos].map(([id, cartas]) => ({ id, set: n.sets?.[id] ?? this.base.sets[id] ?? { n: id }, cartas }))
  }

  /** Las que descartaste, por si quieres recuperarlas. */
  get descartadas(): Carta[] {
    return (this.novedad?.cartas || []).filter((c) => this.decididas[c.id] === 0)
  }

  decidir(ids: string[], si: boolean) {
    this.cambiar((d) => {
      const m = { ...((d.ajustes.novedades as Record<string, number>) || {}) }
      for (const id of ids) m[id] = si ? 1 : 0
      d.ajustes.novedades = m
    })
    this.decisiones++
    this.aplicar()
  }

  olvidarDescartes() {
    this.cambiar((d) => {
      const m = { ...((d.ajustes.novedades as Record<string, number>) || {}) }
      for (const [id, v] of Object.entries(m)) if (v === 0) delete m[id]
      d.ajustes.novedades = m
    })
    this.decisiones++
  }

  /** Todo cambio de datos pasa por aquí. */
  cambiar(fn: (d: Datos) => void) {
    fn(this.datos)
    if (this.pendiente) clearTimeout(this.pendiente)
    this.pendiente = setTimeout(() => this.guardarYa(), 250)
  }

  guardarYa() {
    if (this.pendiente) { clearTimeout(this.pendiente); this.pendiente = null }
    // $state.snapshot: lo que se guarda es un objeto llano, no el proxy
    return almacen.guardar($state.snapshot(this.datos) as Datos)
  }

  reemplazar(nuevos: Partial<Datos>) {
    const base = almacen.inicial()
    this.datos = { ...base, ...(nuevos as Datos), ajustes: { ...base.ajustes, ...(nuevos.ajustes || {}) } }
    this.guardarYa()
    this.decisiones++
    this.aplicar()
  }

  reiniciar() {
    almacen.borrarTodo()
    this.datos = almacen.inicial()
  }

  /** Los Pokémon que se enseñan: con o sin las preevoluciones. */
  get pokemonVisibles(): Pokemon[] {
    return this.datos.ajustes.verFamilias ? this.pokemon : this.pokemon.filter((p) => p.principal)
  }
}

export const app = new Tienda()

// no perder el último toque si el móvil cierra la app enseguida
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') app.guardarYa() })
  addEventListener('pagehide', () => app.guardarYa())
}

/* ------------------------- las cartas ------------------------- */

/** Las cartas del idioma elegido, de los Pokémon que se ven. */
export function delIdioma(idioma: Idioma = app.idioma) {
  const ids = new globalThis.Set(app.pokemonVisibles.map((p) => p.id))
  return app.cartas.filter((c) => (idioma === 'ja') === (c.l === 'ja') && c.p.some((p) => ids.has(p)))
}

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

/* ----------------------- tu colección ----------------------- */
/* Forma: { 'base1-4': { holo: 1, firstEdition: 2 } }. Solo se guarda lo que
   se tiene: ausencia = no la tengo. El progreso cuenta cartas, no ejemplares. */

export const cuantas = (id: string, variante?: string) => {
  const c = app.datos.coleccion[id]
  if (!c) return 0
  return variante ? c[variante] || 0 : Object.values(c).reduce((a, n) => a + n, 0)
}
export const tengo = (id: string) => cuantas(id) > 0

/** La variante que se asume al marcar de un toque. */
export function variantePrincipal(c: Carta) {
  for (const v of ['normal', 'holo', 'reverse', 'wPromo', 'firstEdition']) if (c.v.includes(v)) return v
  return c.v[0] || 'normal'
}

/** Un toque: si la tengo, la quito entera; si no, la marco en su variante principal. */
export function alternar(c: Carta) {
  app.cambiar((d) => {
    if (cuantas(c.id) > 0) delete d.coleccion[c.id]
    else d.coleccion[c.id] = { [variantePrincipal(c)]: 1 }
  })
}

export function ponerVariante(id: string, variante: string, cantidad: number) {
  app.cambiar((d) => {
    const c = { ...(d.coleccion[id] || {}) }
    if (cantidad > 0) c[variante] = Math.min(99, cantidad)
    else delete c[variante]
    if (Object.keys(c).length) d.coleccion[id] = c
    else delete d.coleccion[id]
  })
}

export const progreso = (cartas: Carta[]) => {
  const t = cartas.filter((c) => tengo(c.id)).length
  return { tengo: t, total: cartas.length, faltan: cartas.length - t, parte: cartas.length ? t / cartas.length : 0 }
}

/* --------------------- cómo se enseña una carta --------------------- */

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

export const NOMBRE_VARIANTE: Record<string, string> = {
  normal: 'Normal', holo: 'Holo', reverse: 'Reverse holo', firstEdition: '1.ª edición', wPromo: 'Promo',
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

/* ---------------------- logos de las expansiones ---------------------- */

export const logos = $state({
  ids: new globalThis.Set<string>(),
  series: {} as Record<string, { serie: string; slug: string; s: number; p: number }>,
})
export function cargarLogos(base = '') {
  fetch(`${base}logos/lista.json`).then((r) => r.json()).then((l: string[]) => { logos.ids = new globalThis.Set(l) }).catch(() => {})
  fetch(`${base}logos/series.json`).then((r) => r.json())
    .then((d: typeof logos.series) => { logos.series = d }).catch(() => {})
}
