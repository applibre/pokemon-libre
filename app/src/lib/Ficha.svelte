<!-- La ficha: la carta grande, en 3D, con sus datos, y flechas para pasar a
     la siguiente. Se abre con el vuelo de la carta desde su celda. -->
<script lang="ts">
  import { rutas } from './rutas'
  import Carta3D from './Carta3D.svelte'
  import { app, tengo, cuantas, alternar, ponerVariante, numeroImpreso, ETAPA, nombreVariante, mesYAnio, type Carta } from './store.svelte'
  import { foil } from './foil'

  let { lista, indice, cerrar, ir }: {
    lista: Carta[]; indice: number; cerrar: () => void; ir: (i: number) => void
  } = $props()

  const c = $derived(lista[indice])
  const set = $derived(app.sets[c.s] ?? { n: c.s })
  const mia = $derived(tengo(c.id))
  const esJa = $derived(c.l === 'ja')

  const filas = $derived.by(() => {
    const f: [string, string][] = []
    if (c.r) f.push(['Rareza', c.r.replace(/ \([A-Z]+\)$/, '')])
    if (c.ill) f.push(['Ilustración', c.ill])
    if (set.rel) f.push(['Salió en', mesYAnio(set.rel)])
    if (esJa) f.push(['Edición', `japonesa${set.cod ? ` · ${set.cod}` : ''}`])
    const j = c.j
    if (j) {
      const p: string[] = []
      if (j.e) p.push(ETAPA[j.e] ?? j.e)
      if (j.de) p.push(`evoluciona de ${j.de}`)
      if (j.ps) p.push(`${j.ps} PS`)
      if (p.length) f.push(['La carta', p.join(' · ')])
    }
    return f
  })

  /* en una carta-variante (el sello de Pokémon Day…) lo que importa es qué variante es; si además
     salió en varias formas se añade cuál (Holo, Reverse…) */
  const etiqueta = (v: string) => !c.vn ? nombreVariante(v) : c.v.length === 1 ? nombreVariante(c.vn) : `${nombreVariante(c.vn)} · ${nombreVariante(v)}`

  const hayPrev = $derived(indice > 0)
  const haySig = $derived(indice < lista.length - 1)

  function teclas(e: KeyboardEvent) {
    if (e.key === 'Escape') cerrar()
    else if (e.key === 'ArrowLeft' && hayPrev) ir(indice - 1)
    else if (e.key === 'ArrowRight' && haySig) ir(indice + 1)
  }

  /* deslizar con el dedo para pasar de carta; fuera de la carta, para no
     pelearse con la inclinación */
  let ini: { x: number; y: number } | null = null
  function abajo(e: PointerEvent) {
    ini = (e.target as HTMLElement).closest('.card') ? null : { x: e.clientX, y: e.clientY }
  }
  function arriba(e: PointerEvent) {
    if (!ini) return
    const dx = e.clientX - ini.x, dy = e.clientY - ini.y
    ini = null
    if (Math.abs(dx) > 56 && Math.abs(dy) < 44) {
      if (dx < 0 && haySig) ir(indice + 1)
      else if (dx > 0 && hayPrev) ir(indice - 1)
    }
  }
</script>

<svelte:window onkeydown={teclas} />

<div class="velo" onclick={cerrar} role="presentation"></div>

<section class="ficha" role="dialog" aria-modal="true" aria-label="{c.n} {numeroImpreso(c)}{c.vn ? ` (${nombreVariante(c.vn)})` : ''}" onpointerdown={abajo} onpointerup={arriba}>
  <button class="cruz" onclick={cerrar} aria-label="Cerrar">
    <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>

  <header class="cab">
    <h2>{c.n}</h2>
    {#if c.vn}<p class="vn">{nombreVariante(c.vn)}</p>{/if}
    <p>{esJa ? 'Japonesa · ' : ''}{set.n} · {numeroImpreso(c)}</p>
  </header>

  <div class="escena">
    <button class="flecha izq" onclick={() => ir(indice - 1)} disabled={!hayPrev} aria-label="Carta anterior">
      <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
    </button>

    <div class="carta" style="view-transition-name: carta">
      {#key c.id}
        <Carta3D src={rutas.cartaGrande(c.id)} alt={c.n} foil={foil(c)} />
      {/key}
    </div>

    <button class="flecha der" onclick={() => ir(indice + 1)} disabled={!haySig} aria-label="Carta siguiente">
      <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
    </button>
  </div>

  <p class="pos">{indice + 1} de {lista.length}</p>

  <!-- cuántas tienes de cada forma en que salió esta carta -->
  <div class="variantes">
    {#each c.v as v (v)}
      {@const n = cuantas(c.id, v)}
      <div class="variante" class:hay={n > 0}>
        <button class="menos" onclick={() => ponerVariante(c.id, v, n - 1)} disabled={n === 0} aria-label="Quitar una {etiqueta(v)}">−</button>
        <span class="n" aria-live="polite">{n}</span>
        <button class="mas" onclick={() => ponerVariante(c.id, v, n + 1)} aria-label="Añadir una {etiqueta(v)}">+</button>
        <span class="nom">{etiqueta(v)}</span>
      </div>
    {/each}
  </div>

  <dl class="datos">
    {#each filas as [k, v]}
      <div><dt>{k}</dt><dd>{v}</dd></div>
    {/each}
  </dl>

  <button class="tengo" class:mia onclick={() => alternar(c)}>
    {#if mia}
      <svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2 8.8-9" /></svg>La tengo
    {:else}
      Marcar que la tengo
    {/if}
  </button>

  <div class="tiendas">
    {#if c.tc_id}
      <a href="https://www.tcgcollector.com/cards/{c.tc_id}/{c.tc_slug}" target="_blank" rel="noopener">Ver en TCG Collector</a>
    {/if}
    {#if c.tp_id}
      <a href="https://www.tcgplayer.com/product/{c.tp_id}" target="_blank" rel="noopener">Ver en TCGplayer</a>
    {/if}
  </div>
</section>

<style>
  .velo {
    position: fixed; inset: 0; z-index: 40; background: rgba(9, 22, 52, .58); backdrop-filter: blur(7px);
    animation: entra .25s ease both;
  }
  .ficha {
    position: fixed; z-index: 41; left: 50%; top: 50%; translate: -50% -50%;
    width: min(440px, calc(100vw - 20px)); max-height: calc(100dvh - 24px); overflow-y: auto;
    padding: 14px 16px 18px; border-radius: var(--radio-l); background: var(--papel);
    box-shadow: var(--sombra-2); display: grid; gap: 12px;
    animation: abre .34s cubic-bezier(.2, .9, .25, 1) both;
  }
  @keyframes entra { from { opacity: 0; } }
  @keyframes abre { from { opacity: 0; scale: .94; } }

  .cruz {
    position: absolute; top: 10px; right: 10px; z-index: 5; width: 34px; height: 34px; padding: 0;
    border: 0; border-radius: 50%; background: var(--hueco); display: grid; place-items: center;
  }
  .cruz svg { width: 18px; height: 18px; fill: none; stroke: var(--tinta-2); stroke-width: 2.4; stroke-linecap: round; }
  .cab { padding-right: 40px; }
  h2 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
  .cab p { margin: 3px 0 0; font-size: 13.5px; color: var(--tinta-3); font-weight: 600; }
  .cab p.vn { color: #a06f00; font-weight: 800; font-size: 14px; }

  .escena { position: relative; display: grid; place-items: center; padding: 6px 0 2px; }
  .carta { width: min(62vw, 250px); }
  .flecha {
    position: absolute; top: 50%; translate: 0 -50%; z-index: 4; width: 38px; height: 38px; padding: 0;
    border: 0; border-radius: 50%; background: var(--papel); box-shadow: var(--sombra-1);
    display: grid; place-items: center; transition: transform .15s, opacity .2s;
  }
  .flecha:disabled { opacity: .25; pointer-events: none; }
  .flecha:active { transform: scale(.9); }
  .flecha svg { width: 20px; height: 20px; fill: none; stroke: var(--azul); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .izq { left: -4px; }
  .der { right: -4px; }
  .pos { margin: 0; text-align: center; font-size: 12px; color: var(--tinta-3); font-weight: 600; letter-spacing: .04em; }

  .variantes { display: grid; gap: 8px; }
  .variante {
    display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radio-m);
    border: 1px solid var(--linea); background: var(--papel); transition: border-color .2s, background .2s;
  }
  .variante.hay { border-color: var(--oro); background: color-mix(in srgb, var(--oro) 9%, var(--papel)); }
  .variante button {
    width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: var(--hueco);
    font-size: 20px; font-weight: 800; color: var(--azul); display: grid; place-items: center; touch-action: manipulation;
    transition: transform .12s, background .15s;
  }
  .variante button:active { transform: scale(.88); background: var(--linea); }
  .variante button:disabled { opacity: .35; pointer-events: none; }
  .variante .n { min-width: 26px; text-align: center; font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .variante .nom { font-weight: 700; font-size: 15px; margin-left: 2px; }

  .datos { margin: 0; border: 1px solid var(--linea); border-radius: var(--radio-m); overflow: hidden; }
  .datos div { display: flex; justify-content: space-between; gap: 14px; padding: 10px 14px; font-size: 14px; }
  .datos div + div { border-top: 1px solid var(--linea); }
  dt { color: var(--tinta-3); font-weight: 600; flex: none; }
  dd { margin: 0; font-weight: 700; text-align: right; min-width: 0; overflow-wrap: anywhere; }

  .tengo {
    display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; border: 0;
    border-radius: 14px; font-size: 16px; font-weight: 800; color: #fff;
    background: linear-gradient(180deg, #2fb96b, #178048);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 4px 12px rgba(23,128,72,.35);
    transition: transform .15s, background .2s;
  }
  .tengo:active { transform: scale(.98); }
  .tengo.mia {
    background: linear-gradient(180deg, #f6c33a, #d99a0c); color: #4a3200;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 4px 12px rgba(201,143,10,.4);
  }
  .tengo svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }

  .tiendas { display: flex; gap: 8px; flex-wrap: wrap; }
  .tiendas a {
    flex: 1 1 140px; text-align: center; padding: 11px 12px; border-radius: 12px; font-size: 13.5px; font-weight: 700;
    color: var(--azul); background: var(--hueco); text-decoration: none; transition: background .15s;
  }
  .tiendas a:active { background: var(--linea); }
</style>
