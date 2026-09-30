/* Avisos breves y confirmaciones dentro de la propia página: el navegador
   móvil tapa los alert() y confirm(), y una acción que borra datos merece
   algo mejor que un cuadro del sistema. */

export type Aviso = { id: number; texto: string; tono: 'normal' | 'bueno' | 'malo' }
export type Pregunta = {
  titulo: string; sub?: string; aceptar: string; peligro?: boolean
  resolver: (ok: boolean) => void
}

export const avisos = $state({
  lista: [] as Aviso[],
  pregunta: null as Pregunta | null,
})

let contador = 0
export function avisar(texto: string, tono: Aviso['tono'] = 'normal') {
  const id = ++contador
  avisos.lista.push({ id, texto, tono })
  setTimeout(() => { avisos.lista = avisos.lista.filter((a) => a.id !== id) }, 2600)
}

export function confirmar(titulo: string, sub: string, aceptar = 'Sí, continuar', peligro = false): Promise<boolean> {
  return new Promise((resolver) => {
    avisos.pregunta = { titulo, sub, aceptar, peligro, resolver }
  })
}
export function responder(ok: boolean) {
  avisos.pregunta?.resolver(ok)
  avisos.pregunta = null
}
