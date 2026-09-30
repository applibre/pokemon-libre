/* Las direcciones dependen de dónde viva la app y de dónde vivan los datos.

   La app puede publicarse en una subcarpeta (/pokemon-libre/nueva/) mientras
   las cartas siguen en /pokemon-libre/data/: son dos raíces distintas. En
   desarrollo son la misma. Escribirlas a mano con «/» rompería la
   publicación, así que todas salen de aquí. */
const APP = import.meta.env.BASE_URL
const DATOS = import.meta.env.VITE_DATOS ?? APP

export const rutas = {
  datos: DATOS,
  carta: (id: string) => `${DATOS}data/cartas/${id}.webp`,
  cartaGrande: (id: string) => `${DATOS}data/cartas/g/${id}.webp`,
  logo: (id: string) => `${APP}logos/${id}.webp`,
  serie: (slug: string) => `${APP}logos/series/${slug}.webp`,
  logos: APP,
}
