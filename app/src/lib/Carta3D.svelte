<!--
  La carta en 3D con foil holográfico.

  Basado en el trabajo de simeydotme (pokemon-cards-css, GPL-3.0):
  https://github.com/simeydotme/pokemon-cards-css
  Reescrito para Svelte 5. La idea es suya: unas quince variables CSS
  (dónde está el dedo, cuánto gira, cuánto brilla) que una física de
  muelles va moviendo, y una capa de textura distinta por rareza. El
  navegador solo compone, no recalcula: por eso va fluido en el móvil.
-->
<script lang="ts">
  import { Spring } from 'svelte/motion'

  let { src, alt, foil = 'common', tipo = '', etapa = '' }: {
    src: string; alt: string; foil?: string; tipo?: string; etapa?: string
  } = $props()

  const suave = { stiffness: 0.066, damping: 0.25 }
  const vuelta = { stiffness: 0.01, damping: 0.06 }

  const giro = new Spring({ x: 0, y: 0 }, suave)
  const brillo = new Spring({ x: 50, y: 50, o: 0 }, suave)
  const fondo = new Spring({ x: 50, y: 50 }, suave)

  let cargada = $state(false)
  let tocando = $state(false)
  let pendiente: { x: number; y: number; el: HTMLElement } | null = null
  let cuadro = 0

  const limita = (v: number, a = 0, b = 100) => Math.min(Math.max(v, a), b)
  const ajusta = (v: number, a1: number, a2: number, b1: number, b2: number) =>
    b1 + ((v - a1) * (b2 - b1)) / (a2 - a1)

  function mover(e: PointerEvent) {
    // currentTarget solo existe mientras dura el evento: se guarda ahora,
    // porque el cálculo se hace en el siguiente cuadro de animación
    pendiente = { x: e.clientX, y: e.clientY, el: e.currentTarget as HTMLElement }
    if (cuadro) return
    cuadro = requestAnimationFrame(() => {
      cuadro = 0
      if (!pendiente) return
      const r = pendiente.el.getBoundingClientRect()
      const px = limita(((pendiente.x - r.left) / r.width) * 100)
      const py = limita(((pendiente.y - r.top) / r.height) * 100)
      const cx = px - 50, cy = py - 50
      giro.stiffness = suave.stiffness; giro.damping = suave.damping
      brillo.stiffness = suave.stiffness; brillo.damping = suave.damping
      fondo.stiffness = suave.stiffness; fondo.damping = suave.damping
      giro.target = { x: -(cx / 3.5), y: cy / 3.5 }
      brillo.target = { x: px, y: py, o: 1 }
      fondo.target = { x: ajusta(px, 0, 100, 37, 63), y: ajusta(py, 0, 100, 33, 67) }
      tocando = true
    })
  }

  function soltar() {
    if (cuadro) { cancelAnimationFrame(cuadro); cuadro = 0 }
    pendiente = null
    tocando = false
    for (const s of [giro, brillo, fondo]) { s.stiffness = vuelta.stiffness; s.damping = vuelta.damping }
    giro.target = { x: 0, y: 0 }
    brillo.target = { x: 50, y: 50, o: 0 }
    fondo.target = { x: 50, y: 50 }
  }

  const estilo = $derived.by(() => {
    const dx = brillo.current.x - 50, dy = brillo.current.y - 50
    const centro = limita(Math.sqrt(dx * dx + dy * dy) / 50, 0, 1)
    return [
      `--pointer-x:${brillo.current.x}%`, `--pointer-y:${brillo.current.y}%`,
      `--pointer-from-center:${centro}`, `--pointer-from-top:${brillo.current.y / 100}`,
      `--pointer-from-left:${brillo.current.x / 100}`, `--card-opacity:${brillo.current.o}`,
      `--rotate-x:${giro.current.x}deg`, `--rotate-y:${giro.current.y}deg`,
      `--background-x:${fondo.current.x}%`, `--background-y:${fondo.current.y}%`,
    ].join(';')
  })
</script>

<div
  class="card interactive {tipo}"
  class:interacting={tocando}
  class:loading={!cargada}
  data-rarity={foil}
  data-subtypes={etapa.toLowerCase()}
  data-supertype="pokémon"
  data-number="0"
  style="{estilo}; --seedx:.31; --seedy:.62; --cosmosbg:120px 380px"
>
  <div class="card__translater">
    <div
      class="card__rotator"
      role="img"
      aria-label={alt}
      onpointermove={mover}
      onpointerleave={soltar}
      onpointercancel={soltar}
      style="touch-action: pan-y"
    >
      <div class="card__back"></div>
      <div class="card__front">
        <img {src} {alt} width="600" height="838" decoding="async" onload={() => (cargada = true)} />
        <div class="card__shine"></div>
        <div class="card__glare"></div>
      </div>
    </div>
  </div>
</div>

<style>
  /* el reverso: dibujado, sin imágenes externas */
  .card__back {
    background:
      radial-gradient(circle at 50% 50%, #fff 0 9%, #d63a3a 9.5% 15%, transparent 15.5%),
      radial-gradient(120% 90% at 50% 12%, #4f78e6 0%, #24379a 55%, #131a4d 100%);
    border-radius: var(--card-radius);
  }
  .card { width: 100%; }
</style>
