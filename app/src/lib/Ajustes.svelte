<!-- Ajustes: qué se ve, tus datos (la copia de seguridad es la única red que hay
     cuando no existe servidor), el aspecto y el catálogo. -->
<script lang="ts">
  import Cinta from './Cinta.svelte'
  import { onMount } from 'svelte'
  import { app, type Tema, type Idioma } from './store.svelte'
  import { rutas } from './rutas'
  import { textoDeCopia } from './almacen'
  import { avisar, confirmar } from './mensajes.svelte'

  const marcadas = $derived(Object.keys(app.datos.coleccion).length)
  const ejemplares = $derived(Object.values(app.datos.coleccion).reduce((a, c) => a + Object.values(c).reduce((x, n) => x + n, 0), 0))
  const aj = $derived(app.datos.ajustes)

  function copia() {
    const hoy = new Date().toISOString().slice(0, 10)
    const blob = new Blob([textoDeCopia($state.snapshot(app.datos), app.man.version ?? null)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pokemon-libre-${hoy}.json`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    app.cambiar((d) => { d.ultimaCopia = hoy })
    avisar('Copia guardada', 'bueno')
  }

  function restaurar() {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json,application/json'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      let d: { coleccion?: Record<string, unknown>; ajustes?: object }
      try { d = JSON.parse(await f.text()) } catch { avisar('El fichero no se puede leer', 'malo'); return }
      if (!d || typeof d !== 'object' || !d.coleccion) { avisar('El fichero no parece una copia de Pokémon Libre', 'malo'); return }
      const cuantas = Object.keys(d.coleccion).length
      if (!(await confirmar(`¿Restaurar ${cuantas} cartas?`, 'Sustituirá la colección que tienes ahora en la app.', 'Sí, restaurar', true))) return
      app.reemplazar(d as never)
      avisar('Colección restaurada', 'bueno')
      location.hash = '/'
    }
    inp.click()
  }

  async function borrar() {
    if (!(await confirmar('¿Borrar tu colección?', 'Se pierden todas las marcas. No se puede deshacer y no hay copia en ningún servidor.', 'Borrar todo', true))) return
    app.reiniciar()
    location.hash = '/'
    location.reload()
  }

  /* ---- guardar las cartas para usarlas sin internet ----
     Las imágenes se guardan según las ves. Este botón las pide todas de una
     vez: el service worker las va dejando en su caché mientras pasan. */
  let guardadas = $state(0)
  let bajando = $state(false)
  let hechas = $state(0)
  let cancelar = false
  const hayServicio = $derived(typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller)
  const total = $derived(app.cartas.length)

  async function contar() {
    try {
      const c = await caches.open('pl2-cartas')
      guardadas = (await c.keys()).filter((r) => !/\/g\//.test(r.url)).length
    } catch { guardadas = 0 }
  }
  onMount(contar)

  async function guardarTodo() {
    bajando = true; cancelar = false; hechas = 0
    const ids = app.cartas.map((c) => c.id)
    let i = 0
    const obrero = async () => {
      while (i < ids.length && !cancelar) {
        const id = ids[i++]
        try { await fetch(rutas.carta(id)) } catch { /* sin red: se cuenta y se sigue */ }
        hechas++
      }
    }
    await Promise.all(Array.from({ length: 6 }, obrero))
    bajando = false
    // el service worker termina de guardar un instante después de servir la última
    await new Promise((r) => setTimeout(r, 1200))
    await contar()
    avisar(cancelar ? 'Descarga detenida' : `Listo: ${guardadas} cartas guardadas`, cancelar ? 'normal' : 'bueno')
  }

  const temas: [Tema, string][] = [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]
  const idiomas: [Idioma, string][] = [['en', 'Inglés'], ['ja', 'Japonés']]
</script>

<div class="ajustes">
  <section class="panel">
    <Cinta titulo="Qué se ve" />
    <div class="cuerpo">
      <label class="fila">
        <span>Preevoluciones<small>Gastly, Haunter, Pichu, Raichu y Munchlax</small></span>
        <input type="checkbox" class="interruptor" checked={aj.verFamilias}
               onchange={(e) => app.cambiar((d) => { d.ajustes.verFamilias = e.currentTarget.checked })} />
      </label>
      <div class="fila alta"><span>Idioma de las cartas<small>Son dos colecciones distintas: en cada una cuentas lo tuyo por separado</small></span></div>
      <div class="segmentos" role="group" aria-label="Idioma">
        {#each idiomas as [v, t] (v)}
          <button class:v={app.idioma === v} onclick={() => (app.idioma = v)}>{t}</button>
        {/each}
      </div>
    </div>
  </section>

  <section class="panel">
    <Cinta color="verde" titulo="Tus datos" />
    <div class="cuerpo">
      <p class="nota"><b>Tu colección vive solo en este dispositivo.</b> No hay cuenta ni servidor, y nadie más puede verla. Por eso la copia importa: si borras los datos del navegador, se va. La app oficial de Pokémon cerró en 2023 y se llevó las colecciones de todos; aquí eso no puede pasar, pero la copia la tienes que guardar tú.</p>
      <div class="fila"><span>Cartas marcadas</span><b class="v">{marcadas}</b></div>
      <div class="fila"><span>Ejemplares en total</span><b class="v">{ejemplares}</b></div>
      <div class="fila"><span>Última copia</span><b class="v">{app.datos.ultimaCopia ?? 'ninguna'}</b></div>
      <div class="botones">
        <button class="btn principal" data-copia onclick={copia}>Guardar una copia</button>
        <button class="btn" data-restaurar onclick={restaurar}>Restaurar desde una copia</button>
      </div>
    </div>
  </section>

  <section class="panel">
    <Cinta color="naranja" titulo="Aspecto" />
    <div class="cuerpo">
      <div class="segmentos" role="group" aria-label="Tema">
        {#each temas as [v, t] (v)}
          <button class:v={aj.tema === v} data-tema={v} onclick={() => app.cambiar((d) => { d.ajustes.tema = v })}>{t}</button>
        {/each}
      </div>
    </div>
  </section>

  <section class="panel">
    <Cinta titulo="Sin internet" />
    <div class="cuerpo">
      <div class="fila"><span>Cartas guardadas en el móvil</span><b class="v">{guardadas} de {total}</b></div>
      <div class="barra" aria-hidden="true"><i style="width:{total ? ((bajando ? Math.max(hechas, guardadas) : guardadas) / total) * 100 : 0}%"></i></div>
      <p class="nota">La app y el catálogo ya funcionan sin conexión. Las imágenes se guardan según las vas viendo; con este botón se guardan todas de una vez (unos 60 MB, conviene con wifi).</p>
      {#if bajando}
        <button class="btn" data-parar onclick={() => (cancelar = true)}>Detener · {hechas} de {total}</button>
      {:else}
        <button class="btn principal" data-guardar-todo onclick={guardarTodo} disabled={!hayServicio || guardadas >= total}>
          {guardadas >= total ? 'Todas guardadas' : 'Guardar todas las cartas'}
        </button>
        {#if !hayServicio}<p class="nota">Disponible cuando la app esté instalada y cargada por segunda vez.</p>{/if}
      {/if}
    </div>
  </section>

  <section class="panel">
    <Cinta titulo="El catálogo" />
    <div class="cuerpo">
      <div class="fila"><span>Cartas</span><b class="v">{app.man.cartas ?? app.cartas.length}</b></div>
      <div class="fila"><span>Colecciones</span><b class="v">{app.man.sets ?? Object.keys(app.sets).length}</b></div>
      <p class="nota">Ningún servicio externo hace falta para ver tus cartas: el catálogo y las imágenes son de la propia app.</p>
    </div>
  </section>

  <section class="panel">
    <Cinta titulo="Sobre Pokémon Libre" />
    <div class="cuerpo">
      <p class="nota">Software libre de <b>applibre</b>. Gratis de verdad: sin anuncios, sin cuenta y sin suscripción.</p>
      <p class="nota">Proyecto de aficionado, sin relación con Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Las imágenes de las cartas son de sus autores y se muestran solo para llevar el control de una colección personal. El efecto holográfico es una adaptación de <b>pokemon-cards-css</b>, de simeydotme (GPL-3.0).</p>
      <button class="btn peligro" data-borrar onclick={borrar}>Borrar mi colección</button>
    </div>
  </section>
</div>

<style>
  .ajustes { display: grid; gap: 14px; }
  .panel { background: var(--papel); border-radius: var(--radio-l); box-shadow: var(--sombra-1); overflow: hidden; }
  .cuerpo { padding: 6px 16px 16px; display: grid; gap: 4px; }
  .fila { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 11px 0; font-size: 15px; font-weight: 600; }
  .fila + .fila { border-top: 1px solid var(--linea); }
  .fila small { display: block; margin-top: 2px; font-size: 12.5px; font-weight: 500; color: var(--tinta-3); }
  .fila.alta { align-items: flex-start; }
  .v { font-variant-numeric: tabular-nums; }
  .nota { margin: 8px 0; font-size: 13.5px; line-height: 1.5; color: var(--tinta-2); }

  .interruptor {
    appearance: none; flex: none; width: 50px; height: 30px; border-radius: 999px; background: var(--linea); position: relative;
    cursor: pointer; transition: background .2s; border: 0;
  }
  .interruptor::after {
    content: ""; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,.3); transition: translate .22s cubic-bezier(.3, 1.4, .5, 1);
  }
  .interruptor:checked { background: var(--verde); }
  .interruptor:checked::after { translate: 20px 0; }

  .segmentos { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px; padding: 4px; border-radius: 14px; background: var(--hueco); }
  .segmentos button { min-height: 42px; border: 0; border-radius: 11px; background: none; font-size: 14.5px; font-weight: 800; color: var(--tinta-2); transition: background .2s, color .2s, box-shadow .2s; }
  .segmentos button.v { background: var(--papel); color: var(--azul); box-shadow: var(--sombra-1); }

  .barra { height: 7px; border-radius: 999px; background: var(--hueco); overflow: hidden; margin: 2px 0 6px; }
  .barra i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2fb96b, #178048); transition: width .3s; }
  .btn:disabled { opacity: .5; pointer-events: none; }

  .botones { display: grid; gap: 10px; margin-top: 10px; }
  .btn { min-height: 48px; border: 0; border-radius: 14px; font-size: 15px; font-weight: 800; background: var(--hueco); color: var(--tinta); transition: transform .12s; }
  .btn:active { transform: scale(.98); }
  .btn.principal { background: linear-gradient(180deg, var(--azul-alto), var(--azul-bajo)); color: #fff; }
  .btn.peligro { background: color-mix(in srgb, #c2412b 14%, var(--papel)); color: #c2412b; margin-top: 8px; }
</style>
