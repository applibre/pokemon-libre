/* ===================================================================
   Almacén: la colección vive en este dispositivo.

   Es el mismo que el de la app anterior, a propósito. La nueva ocupará
   la misma dirección y por tanto el mismo almacenamiento del móvil: la
   clave, la forma de los datos, la migración y la copia diaria son
   idénticas, y lo que la app vieja guardó, esta lo lee sin tocarlo.

   Como no hay servidor ni cuenta, perder los datos sería definitivo:

     · si vienen corruptos, se apartan con otro nombre, no se destruyen
     · antes de la primera escritura de cada día se deja una copia
     · se pide al navegador que no borre nada por falta de espacio
     · lo que este código no conoce se conserva tal cual: un campo que
       añada otra versión no se pierde al guardar
   =================================================================== */

export const CLAVE = 'pokemon-libre'
export const COPIA = 'pokemon-libre-copia'
export const VERSION = 1

export type Idioma = 'en' | 'ja'
export type Tema = 'auto' | 'claro' | 'oscuro'

export type Ajustes = {
  tema: Tema
  verFamilias: boolean
  idioma: Idioma | 'todo'     // 'todo' es de la app anterior: aquí cuenta como inglés
  verPrecios: boolean
  moneda: string
  [otro: string]: unknown
}

export type Datos = {
  schemaVersion: number
  coleccion: Record<string, Record<string, number>>   // { 'base1-4': { holo: 1, firstEdition: 2 } }
  ajustes: Ajustes
  creado: string | null
  ultimaCopia: string | null
  [otro: string]: unknown
}

export const inicial = (): Datos => ({
  schemaVersion: VERSION,
  coleccion: {},
  ajustes: { tema: 'claro', verFamilias: true, idioma: 'en', verPrecios: true, moneda: 'eur' },
  creado: null,
  ultimaCopia: null,
})

/** 1 → 2: la app nació siguiendo al sistema y a quien tenía el móvil en
    oscuro le salía un álbum negro. Se pasa a claro una vez; quien quiera
    oscuro lo elige en Ajustes y no se le toca más. */
const migraciones: ((d: Datos) => Datos)[] = [
  (d) => {
    if (d.ajustes?.tema === 'auto') d.ajustes.tema = 'claro'
    return d
  },
]

function migrar(d: Datos): Datos {
  let v = d.schemaVersion || 1
  while (v - 1 < migraciones.length) { d = migraciones[v - 1](d); v++; d.schemaVersion = v }
  return d
}

export function leer(): Datos {
  let crudo: string | null
  try { crudo = localStorage.getItem(CLAVE) } catch { return inicial() }
  if (!crudo) return inicial()
  try {
    const d = JSON.parse(crudo)
    if (!d || typeof d !== 'object') throw new Error('no es un objeto')
    const base = inicial()
    return migrar({ ...base, ...d, ajustes: { ...base.ajustes, ...(d.ajustes || {}) } })
  } catch {
    // no se borra: se aparta por si se puede rescatar
    try { localStorage.setItem(CLAVE + '-corrupto-' + Date.now(), crudo) } catch { /* sin espacio */ }
    return inicial()
  }
}

function copiaDelDia(anterior: unknown) {
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const previa = JSON.parse(localStorage.getItem(COPIA) || 'null')
    if (previa && previa.dia === hoy) return
    if (!anterior) return
    localStorage.setItem(COPIA, JSON.stringify({ dia: hoy, datos: anterior }))
  } catch { /* la copia es un extra: si falla, no se para lo demás */ }
}

export const leerCopia = () => {
  try { return JSON.parse(localStorage.getItem(COPIA) || 'null') } catch { return null }
}

let avisoEspacio: (() => void) | null = null
export const alQuedarseSinEspacio = (fn: () => void) => { avisoEspacio = fn }

export function guardar(datos: Datos): { ok: boolean; lleno?: boolean } {
  let anterior: unknown = null
  try {
    const previo = localStorage.getItem(CLAVE)
    anterior = previo ? JSON.parse(previo) : null
  } catch { /* nada que copiar */ }
  copiaDelDia(anterior)
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos))
    return { ok: true }
  } catch (e) {
    const err = e as { name?: string; code?: number }
    const lleno = !!err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)
    if (lleno && avisoEspacio) avisoEspacio()
    return { ok: false, lleno }
  }
}

export const borrarTodo = () => {
  try { localStorage.removeItem(CLAVE); localStorage.removeItem(COPIA) } catch { /* nada */ }
}

/** El navegador puede tirar los datos si necesita espacio. Pedir que no lo
    haga es gratis, y Chrome lo concede solo si el sitio se usa. */
export async function pedirPermanencia(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch { /* sin soporte */ }
  return false
}

/** El fichero de copia de seguridad: el mismo formato de siempre, para que
    una copia hecha con la app anterior se pueda restaurar en esta y al revés. */
export function textoDeCopia(datos: Datos, versionCatalogo: string | null) {
  return JSON.stringify({
    app: 'pokemon-libre',
    exportado: new Date().toISOString().slice(0, 10),
    catalogo: versionCatalogo,
    coleccion: datos.coleccion,
    ajustes: datos.ajustes,
  }, null, 1)
}
