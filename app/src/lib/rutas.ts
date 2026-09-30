/* Las direcciones de las imágenes dependen de dónde viva la app: en
   desarrollo, en la raíz; publicada, en /pokemon-libre/. Escribirlas a
   mano con «/» las rompería al publicar, así que todas salen de aquí. */
const B = import.meta.env.BASE_URL

export const rutas = {
  carta: (id: string) => `${B}data/cartas/${id}.webp`,
  cartaGrande: (id: string) => `${B}data/cartas/g/${id}.webp`,
  logo: (id: string) => `${B}logos/${id}.webp`,
  serie: (slug: string) => `${B}logos/series/${slug}.webp`,
}
