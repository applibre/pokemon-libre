<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Bandera from './lib/Bandera.svelte'
  import Inicio from './lib/Inicio.svelte'
  import Expansiones from './lib/Expansiones.svelte'
  import Grupos from './lib/Grupos.svelte'
  import Filtros from './lib/Filtros.svelte'
  import Faltan from './lib/Faltan.svelte'
  import Ajustes from './lib/Ajustes.svelte'
  import Ficha from './lib/Ficha.svelte'
  import Avisos from './lib/Avisos.svelte'
  import { app, cargarLogos, cartasDe, delIdioma, ordenar, progreso, tengo, type Carta } from './lib/store.svelte'

  /* Las rutas viven en la dirección (#/pokemon/pikachu), así el botón atrás
     del móvil funciona y una pantalla se puede compartir. */
  let ruta = $state(location.hash.replace(/^#\/?/, ''))
  onMount(() => {
    app.cargar(import.meta.env.BASE_URL)
    cargarLogos(import.meta.env.BASE_URL)
    const cambia = () => (ruta = location.hash.replace(/^#\/?/, ''))
    addEventListener('hashchange', cambia)
    return () => removeEventListener('hashchange', cambia)
  })
  const ir = (r: string) => (location.hash = '/' + r)
  const atras = () => history.back()

  const [seccion, argumento] = $derived(ruta.split('/'))
  type Pantalla = 'inicio' | 'pokemon' | 'set' | 'exp' | 'faltan' | 'ajustes'
  const pantalla = $derived<Pantalla>(
    (['pokemon', 'set', 'exp', 'faltan', 'ajustes'] as const).find((s) => s === seccion) ?? 'inicio')

  /* ---- el tema: claro, oscuro o el del sistema ---- */
  $effect(() => {
    const t = app.tema
    if (t === 'auto') document.documentElement.removeAttribute('data-tema')
    else document.documentElement.dataset.tema = t
    const oscuro = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0c1730' : '#5aaee0')
  })

  /* ---- las cartas de la pantalla, con sus filtros ---- */
  let estado = $state<'todas' | 'faltan' | 'tengo'>('todas')
  let texto = $state('')
  $effect(() => { ruta; estado = 'todas'; texto = '' })      // cada pantalla empieza sin filtros

  const normaliza = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

  const cartasPantalla = $derived.by((): Carta[] => {
    if (!app.listo) return []
    if (pantalla === 'pokemon') return cartasDe(argumento)
    if (pantalla === 'set') return ordenar(delIdioma().filter((c) => c.s === argumento))
    return []
  })
  const cuenta = $derived({
    todas: cartasPantalla.length,
    tengo: cartasPantalla.filter((c) => tengo(c.id)).length,
    faltan: cartasPantalla.filter((c) => !tengo(c.id)).length,
  })
  const cartasVistas = $derived.by(() => {
    const t = normaliza(texto)
    const palabras = t ? t.split(' ') : []
    return cartasPantalla.filter((c) => {
      if (estado === 'tengo' && !tengo(c.id)) return false
      if (estado === 'faltan' && tengo(c.id)) return false
      if (!palabras.length) return true
      const s = app.sets[c.s]
      const hay = normaliza(`${c.n} ${s?.n ?? ''} ${c.num} ${c.ni ?? ''} ${c.r}`)
      return palabras.every((p) => hay.includes(p))
    })
  })

  let activasFaltan = $state<Carta[]>([])
  const listaFicha = $derived(pantalla === 'faltan' ? activasFaltan : cartasVistas)

  const titulo = $derived.by(() => {
    if (pantalla === 'pokemon') return app.pokemon.find((p) => p.id === argumento)?.nombre ?? ''
    if (pantalla === 'set') return app.sets[argumento]?.n ?? ''
    if (pantalla === 'exp') return 'Expansiones'
    if (pantalla === 'faltan') return 'Me faltan'
    if (pantalla === 'ajustes') return 'Ajustes'
    return 'Pokémon Libre'
  })
  const prog = $derived(progreso(cartasPantalla))

  /* ---- la ficha, con el vuelo de la carta ---- */
  let fichaIdx = $state<number | null>(null)
  const transicion = (fn: () => void | Promise<void>) => {
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { fn(); return }
    document.startViewTransition(fn)
  }

  function abrirFicha(c: Carta, img: HTMLElement) {
    const i = listaFicha.findIndex((x) => x.id === c.id)
    img.style.viewTransitionName = 'carta'
    transicion(async () => {
      fichaIdx = i
      await tick()
      img.style.viewTransitionName = ''
    })
  }
  function cerrarFicha() {
    const id = fichaIdx !== null ? listaFicha[fichaIdx]?.id : null
    const img = id ? (document.querySelector(`[data-carta="${id}"] img`) as HTMLElement | null) : null
    transicion(async () => {
      if (img) img.style.viewTransitionName = 'carta'
      // el nombre solo puede estar en un sitio a la vez
      document.querySelector('.ficha .carta')?.setAttribute('style', 'view-transition-name: none')
      fichaIdx = null
      await tick()
      if (img) requestAnimationFrame(() => (img.style.viewTransitionName = ''))
    })
  }
  // si el idioma cambia con la ficha abierta, esa carta ya no está en la lista
  $effect(() => { app.idioma; fichaIdx = null })
</script>

<div class="app">
  <header class="marca">
    {#if pantalla === 'pokemon' || pantalla === 'set'}
      <button class="volver" onclick={atras} aria-label="Volver">
        <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
    {/if}

    <div class="quien">
      {#if pantalla === 'inicio'}
        <span class="logo"><i></i><b>Pokémon</b> Libre</span>
      {:else}
        <h1>{titulo}</h1>
        {#if cartasPantalla.length}<p>{prog.tengo} de {prog.total}</p>{/if}
      {/if}
    </div>

    {#if pantalla !== 'ajustes'}
      <div class="lengua" role="group" aria-label="Idioma de las cartas">
        <span class="pastilla" style="translate: {app.idioma === 'en' ? 0 : 100}% 0"></span>
        <button class:v={app.idioma === 'en'} onclick={() => (app.idioma = 'en')} aria-label="Cartas en inglés" aria-pressed={app.idioma === 'en'}>
          <Bandera pais="en" tam={15} />EN
        </button>
        <button class:v={app.idioma === 'ja'} onclick={() => (app.idioma = 'ja')} aria-label="Cartas en japonés" aria-pressed={app.idioma === 'ja'}>
          <Bandera pais="ja" tam={15} />JP
        </button>
      </div>
    {/if}
  </header>

  <main>
    {#if !app.listo}
      <p class="cargando">Cargando tus cartas…</p>
    {:else if pantalla === 'inicio'}
      <Inicio abrir={(id) => ir('pokemon/' + id)} />
    {:else if pantalla === 'exp'}
      <Expansiones abrir={(id) => ir('set/' + id)} />
    {:else if pantalla === 'faltan'}
      {#key app.idioma}
        <Faltan abrir={abrirFicha} bind:cartasActivas={activasFaltan} />
      {/key}
    {:else if pantalla === 'ajustes'}
      <Ajustes />
    {:else}
      <Filtros bind:estado bind:texto {cuenta} />
      {#if cartasVistas.length}
        {#key app.idioma + ruta + estado}
          <Grupos cartas={cartasVistas} abrir={abrirFicha} />
        {/key}
      {:else}
        <p class="vacio">{texto ? 'Ninguna carta coincide con esa búsqueda.' : estado === 'faltan' ? '¡Las tienes todas! 🎉' : 'No hay nada que enseñar aquí.'}</p>
      {/if}
    {/if}
  </main>

  <nav class="barra" aria-label="Secciones">
    <button class:v={pantalla === 'inicio' || pantalla === 'pokemon'} onclick={() => ir('')}>
      <svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="7" height="16" rx="1.8" /><rect x="13.5" y="4" width="7" height="16" rx="1.8" /></svg>
      Colección
    </button>
    <button class:v={pantalla === 'exp' || pantalla === 'set'} onclick={() => ir('exp')}>
      <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.4" /><path d="M3 10h18M9 5v14" /></svg>
      Expansiones
    </button>
    <button class:v={pantalla === 'faltan'} onclick={() => ir('faltan')}>
      <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h9" /><circle cx="19" cy="18" r="2.5" /></svg>
      Me faltan
    </button>
    <button class:v={pantalla === 'ajustes'} onclick={() => ir('ajustes')}>
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /></svg>
      Ajustes
    </button>
  </nav>
</div>

{#if fichaIdx !== null && listaFicha[fichaIdx]}
  <Ficha lista={listaFicha} indice={fichaIdx} cerrar={cerrarFicha} ir={(i) => (fichaIdx = i)} />
{/if}

<Avisos />

<style>
  .app { max-width: 560px; margin: 0 auto; min-height: 100%; padding: 0 12px calc(92px + env(safe-area-inset-bottom)); }

  .marca {
    position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 10px;
    margin: 0 -12px 12px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
    /* una barra con cuerpo y desenfoque: lo que pasa por debajo se difumina
       en vez de pisar el título */
    background: linear-gradient(180deg, rgba(22, 66, 140, .82), rgba(22, 66, 140, .62));
    backdrop-filter: blur(14px) saturate(1.3);
    box-shadow: 0 1px 0 rgba(255, 255, 255, .16), 0 6px 18px rgba(10, 30, 70, .18);
  }
  :global(:root[data-tema="oscuro"]) .marca { background: linear-gradient(180deg, rgba(8, 16, 36, .88), rgba(8, 16, 36, .7)); }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-tema="claro"]):not([data-tema="oscuro"])) .marca { background: linear-gradient(180deg, rgba(8, 16, 36, .88), rgba(8, 16, 36, .7)); }
  }
  .quien { flex: 1; min-width: 0; color: #fff; text-shadow: 0 1px 8px rgba(10, 40, 100, .45); }
  .quien h1 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .quien p { margin: 1px 0 0; font-size: 12.5px; font-weight: 700; opacity: .92; }
  .logo { font-size: 21px; font-weight: 500; letter-spacing: -.02em; display: flex; align-items: center; gap: 8px; }
  .logo b { font-weight: 800; }
  .logo i {
    width: 22px; height: 22px; border-radius: 50%; flex: none;
    background: linear-gradient(180deg, #ee4b4b 0 46%, #23305a 46% 54%, #fff 54%); box-shadow: 0 0 0 2px #23305a, 0 2px 6px rgba(0,0,0,.3);
  }

  .volver {
    flex: none; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; background: var(--papel);
    display: grid; place-items: center; box-shadow: var(--sombra-1);
  }
  .volver svg { width: 20px; height: 20px; fill: none; stroke: var(--azul); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .volver:active { transform: scale(.92); }

  /* el interruptor de idioma: una pastilla que se desliza */
  .lengua { position: relative; flex: none; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 999px; background: var(--papel); box-shadow: var(--sombra-1); }
  .lengua button { position: relative; z-index: 1; display: flex; align-items: center; gap: 6px; padding: 6px 11px 6px 9px; border: 0; background: none; border-radius: 999px; font-size: 12.5px; font-weight: 800; color: var(--tinta-3); transition: color .25s; }
  .lengua button.v { color: #fff; }
  .pastilla { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 999px; background: linear-gradient(180deg, #4f8df0, #2c66cf); transition: translate .32s cubic-bezier(.3, 1.3, .5, 1); }

  main { display: grid; gap: 14px; }
  .cargando { text-align: center; color: #fff; font-weight: 700; padding: 60px 0; }
  .vacio { text-align: center; padding: 40px 0; font-weight: 800; color: #fff; text-shadow: 0 1px 8px rgba(10,40,100,.4); }

  .barra {
    position: fixed; z-index: 30; left: 50%; bottom: calc(10px + env(safe-area-inset-bottom)); translate: -50% 0;
    width: min(400px, calc(100vw - 20px)); display: grid; grid-template-columns: repeat(4, 1fr); padding: 5px;
    border-radius: 22px; background: color-mix(in srgb, var(--papel) 96%, transparent); box-shadow: 0 6px 24px rgba(20, 45, 90, .28); backdrop-filter: blur(10px);
  }
  .barra button { display: grid; justify-items: center; gap: 3px; padding: 8px 2px 7px; border: 0; background: none; border-radius: 17px; font-size: 10.5px; font-weight: 800; color: var(--tinta-3); transition: color .2s, background .2s; }
  .barra button.v { color: var(--azul); background: color-mix(in srgb, var(--azul) 10%, transparent); }
  .barra svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
</style>
