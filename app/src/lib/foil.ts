/* Qué efecto de foil lleva cada carta. Se afina en la fase 3 con las variantes
   por rareza; de momento las tres familias principales. */


export function foil(c: { r?: string; v?: string[] }): string {
  const r = (c.r || '').toLowerCase()
  if (/rainbow|hyper/.test(r)) return 'rare rainbow'
  if (/secret|illustration|special|gold|shiny|ultra|double/.test(r)) return 'rare secret'
  if (/holo/.test(r) || (c.v || []).includes('holo')) return 'rare holo'
  return 'common'
}
