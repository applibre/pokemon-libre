<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Bandera from './lib/Bandera.svelte'
  import Inicio from './lib/Inicio.svelte'
  import Expansiones from './lib/Expansiones.svelte'
  import Grupos from './lib/Grupos.svelte'
  import Ficha from './lib/Ficha.svelte'
  import { app, cargar, cartasDe, delIdioma, ordenar, progreso, type Carta } from './lib/store.svelte'

  /* Las rutas viven en la dirección (#/pokemon/pikachu), así el botón atrás
     del móvil funciona y una pantalla se puede compartir. */
  let ruta = $state(location.hash.replace(/^#\/?/, ''))
  onMount(() => {
    cargar()
    const cambia = () => (ruta = location.hash.replace(/^#\/?/, ''))
    addEventListener('hashchange', cambia)
    return () => removeEventListener('hashchange', cambia)
  })
  const ir = (r: string) => (location.hash = '/' + r)
  const atras = () => history.back()

  const [seccion, argumento] = $derived(ruta.split('/'))
  const pantalla = $derived(seccion === 'pokemon' ? 'pokemon' : seccion === 'set' ? 'set' : seccion === 'exp' ? 'exp' : 'inicio')

  const cartasPantalla = $derived.by((): Carta[] => {
    if (!app.listo) return []
    if (pantalla === 'pokemon') return cartasDe(argumento)
    if (pantalla === 'set') return ordenar(delIdioma().filter((c) => c.s === argumento))
    return []
  })
  const titulo = $derived.by(() => {
    if (pantalla === 'pokemon') return app.pokemon.find((p) => p.id === argumento)?.nombre ?? ''
    if (pantalla === 'set') return app.sets[argumento]?.n ?? ''
    if (pantalla === 'exp') return 'Expansiones'
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
    const i = cartasPantalla.findIndex((x) => x.id === c.id)
    img.style.viewTransitionName = 'carta'
    transicion(async () => {
      fichaIdx = i
      await tick()
      img.style.viewTransitionName = ''
    })
  }
  function cerrarFicha() {
    const id = fichaIdx !== null ? cartasPantalla[fichaIdx]?.id : null
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

    <div class="lengua" role="group" aria-label="Idioma de las cartas">
      <span class="pastilla" style="translate: {app.idioma === 'en' ? 0 : 100}% 0"></span>
      <button class:v={app.idioma === 'en'} onclick={() => (app.idioma = 'en')} aria-label="Cartas en inglés" aria-pressed={app.idioma === 'en'}>
        <Bandera pais="en" tam={15} />EN
      </button>
      <button class:v={app.idioma === 'ja'} onclick={() => (app.idioma = 'ja')} aria-label="Cartas en japonés" aria-pressed={app.idioma === 'ja'}>
        <Bandera pais="ja" tam={15} />JP
      </button>
    </div>
  </header>

  <main>
    {#if !app.listo}
      <p class="cargando">Cargando tus cartas…</p>
    {:else if pantalla === 'inicio'}
      <Inicio abrir={(id) => ir('pokemon/' + id)} />
    {:else if pantalla === 'exp'}
      <Expansiones abrir={(id) => ir('set/' + id)} />
    {:else}
      {#key app.idioma + ruta}
        <Grupos cartas={cartasPantalla} abrir={abrirFicha} />
      {/key}
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
  </nav>
</div>

{#if fichaIdx !== null && cartasPantalla[fichaIdx]}
  <Ficha lista={cartasPantalla} indice={fichaIdx} cerrar={cerrarFicha} ir={(i) => (fichaIdx = i)} />
{/if}

<style>
  .app { max-width: 560px; margin: 0 auto; min-height: 100%; padding: 0 12px calc(86px + env(safe-area-inset-bottom)); }

  .marca {
    position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 10px;
    margin: 0 -12px 12px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
    background: linear-gradient(180deg, rgba(20, 60, 130, .55), rgba(20, 60, 130, 0)); backdrop-filter: blur(0px);
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
    flex: none; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.95);
    display: grid; place-items: center; box-shadow: var(--sombra-1);
  }
  .volver svg { width: 20px; height: 20px; fill: none; stroke: var(--azul); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .volver:active { transform: scale(.92); }

  /* el interruptor de idioma: una pastilla que se desliza */
  .lengua { position: relative; flex: none; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.95); box-shadow: var(--sombra-1); }
  .lengua button { position: relative; z-index: 1; display: flex; align-items: center; gap: 6px; padding: 6px 11px 6px 9px; border: 0; background: none; border-radius: 999px; font-size: 12.5px; font-weight: 800; color: var(--tinta-3); transition: color .25s; }
  .lengua button.v { color: #fff; }
  .pastilla { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 999px; background: linear-gradient(180deg, #4f8df0, #2c66cf); transition: translate .32s cubic-bezier(.3, 1.3, .5, 1); }

  main { display: grid; gap: 14px; }
  .cargando { text-align: center; color: #fff; font-weight: 700; padding: 60px 0; }

  .barra {
    position: fixed; z-index: 30; left: 50%; bottom: calc(10px + env(safe-area-inset-bottom)); translate: -50% 0;
    width: min(360px, calc(100vw - 24px)); display: grid; grid-template-columns: 1fr 1fr; padding: 5px;
    border-radius: 22px; background: rgba(255,255,255,.96); box-shadow: 0 6px 24px rgba(20, 45, 90, .28); backdrop-filter: blur(10px);
  }
  .barra button { display: grid; justify-items: center; gap: 3px; padding: 8px 4px 7px; border: 0; background: none; border-radius: 17px; font-size: 11.5px; font-weight: 800; color: var(--tinta-3); transition: color .2s, background .2s; }
  .barra button.v { color: var(--azul); background: color-mix(in srgb, var(--azul) 10%, transparent); }
  .barra svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
</style>
