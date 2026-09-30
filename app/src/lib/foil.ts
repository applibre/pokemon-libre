/* ===================================================================
   Qué efecto de foil lleva cada carta.

   El efecto original (pokemon-cards-css) elige su aspecto por cuatro
   atributos de la carta: rareza, subtipo, supertipo y si es de la
   galería de entrenadores. Ese vocabulario es el de la era Espada y
   Escudo; el nuestro viene de TCGdex (inglés) y de TCG Collector
   (japonés) y llega hasta 2026. Esta tabla traduce de uno al otro.

   La regla: cuando dudo, la carta lleva el efecto de la rareza que más
   se le parece y nunca un efecto que la deje ilegible. Lo comprueba
   pruebas/foil.mjs con capturas de una carta de cada tipo.
   =================================================================== */

export type Foil = { rarity: string; subtypes: string; supertype: string; gallery: boolean }

type Entrada = { n: string; r?: string; v?: string[]; num?: string; j?: { e?: string } }

const SIN: Foil = { rarity: 'common', subtypes: '', supertype: 'pokémon', gallery: false }

export function foil(c: Entrada): Foil {
  const nombre = c.n || ''
  const r = (c.r || '').toLowerCase()
  const num = String(c.num || '')
  const etapa = (c.j?.e || '').replace(/\s/g, '').toLowerCase()      // basic · stage1 · stage2
  const base = { ...SIN, subtypes: etapa, gallery: /^(tg|gg)\d/i.test(num) }

  const vmax = /\bVMAX\b/.test(nombre)
  const vstar = /\bVSTAR\b/.test(nombre)
  const v = !vmax && !vstar && /\bV\b/.test(nombre)
  const holo = /holo/.test(r) || (c.v || []).includes('holo')

  // las de rareza más alta primero: una carta cae en la primera que encaja
  if (/amazing/.test(r)) return { ...base, rarity: 'amazing rare' }
  if (/radiant/.test(r)) return { ...base, rarity: 'radiant rare' }
  if (/shiny/.test(r)) return { ...base, rarity: vmax ? 'rare shiny vmax' : v ? 'rare shiny v' : 'rare shiny' }
  if (/rainbow|hyper|\bhr\b|mega hyper/.test(r)) return { ...base, rarity: 'rare rainbow' }
  // «special illustration rare» y «special art rare (SAR)»: las más buscadas de hoy
  if (/secret|special ill|special art|\bsar\b|\bsir\b|gold/.test(r)) return { ...base, rarity: 'rare secret' }
  if (vmax) return { ...base, rarity: 'rare holo vmax' }
  if (vstar) return { ...base, rarity: 'rare holo vstar' }
  if (v) return { ...base, rarity: 'rare holo v' }
  // ex, GX, full art y sus equivalentes japoneses (RR, RRR, SR, UR)
  if (/ultra|double rare|triple rare|super rare|\(rr\)|\(rrr\)|\(sr\)|\(ur\)|\bgx\b|\bex\b/.test(r) || /(\bex|-ex|\bGX)$/i.test(nombre)) {
    return { ...base, rarity: 'rare ultra' }
  }
  // «illustration rare» / «art rare»: ilustración de página entera, sin ser secreta
  if (/illustration|art rare|\(ar\)/.test(r)) return { ...base, rarity: 'rare holo v' }
  if (holo) return { ...base, rarity: 'rare holo' }
  return base
}

/** Una carta sin foil no se inclina con brillo: se queda de cartón. */
export const brilla = (f: Foil) => f.rarity !== 'common'
