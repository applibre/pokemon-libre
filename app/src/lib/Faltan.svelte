<!-- Lo que me falta: la lista de la compra. Se lleva a la tienda por WhatsApp o
     copiada. Sin precios: cambian a diario y para saberlos se abre la tienda. -->
<script lang="ts">
  import Grupos from './Grupos.svelte'
  import { app, delIdioma, cartasDe, tengo, ordenar, numeroImpreso, mesYAnio, type Carta } from './store.svelte'
  import { avisar } from './mensajes.svelte'

  let { abrir, cartasActivas = $bindable([]) }: {
    abrir: (c: Carta, img: HTMLElement) => void; cartasActivas: Carta[]
  } = $props()

  let elegido = $state<string | null>(null)       // null = todos los Pokémon
  const TANDA = 120
  let tope = $state(TANDA)

  const base = $derived(elegido ? cartasDe(elegido) : delIdioma())
  const faltan = $derived(ordenar(base.filter((c) => !tengo(c.id))))
  const mostradas = $derived(faltan.slice(0, tope))
  const quedan = $derived(faltan.length - mostradas.length)

  // lo que ve la pantalla es lo que recorren las flechas de la ficha
  $effect(() => { cartasActivas = mostradas })

  const chips = $derived(app.pokemonVisibles
    .map((p) => ({ p, n: cartasDe(p.id).filter((c) => !tengo(c.id)).length }))
    .filter((x) => x.n > 0))
  const totalFaltan = $derived(delIdioma().filter((c) => !tengo(c.id)).length)

  const TOPE_LISTA = 250

  /** El texto para llevarlo a la tienda. Se corta: una lista de dos mil líneas
      no la lee nadie y WhatsApp ni la manda. */
  function texto() {
    const quien = elegido ? app.pokemon.find((p) => p.id === elegido)?.nombre : 'Mi colección'
    const corta = faltan.slice(0, TOPE_LISTA)
    const l = [`${quien} · me faltan ${faltan.length} de ${base.length}`, '']
    let actual = ''
    for (const c of corta) {
      if (c.s !== actual) {
        actual = c.s
        const s = app.sets[c.s]
        l.push(`— ${s?.n ?? c.s}${s?.rel ? ` (${s.rel.slice(0, 4)})` : ''}`)
      }
      l.push(`   ${numeroImpreso(c)}${c.r ? ` ${c.r.replace(/ \([A-Z]+\)$/, '')}` : ''}  ${c.n}`)
    }
    if (faltan.length > corta.length) l.push('', `… y ${faltan.length - corta.length} más. Filtra por Pokémon para mandarlas por partes.`)
    l.push('', 'Pokémon Libre · applibre.github.io/pokemon-libre')
    return l.join('\n')
  }

  async function compartir() {
    const t = texto()
    try {
      if (navigator.share) { await navigator.share({ title: 'Me faltan', text: t }); avisar('Lista enviada', 'bueno'); return }
    } catch (e) { if ((e as Error).name === 'AbortError') return }
    try { await navigator.clipboard.writeText(t); avisar('Lista copiada: ya puedes pegarla', 'bueno') }
    catch { avisar('No se ha podido compartir', 'malo') }
  }
</script>

<div class="chips" role="group" aria-label="Filtrar por Pokémon">
  <button class:v={elegido === null} onclick={() => { elegido = null; tope = TANDA }}>Todos {totalFaltan}</button>
  {#each chips as x (x.p.id)}
    <button class:v={elegido === x.p.id} onclick={() => { elegido = x.p.id; tope = TANDA }}>{x.p.nombre} {x.n}</button>
  {/each}
</div>

{#if !faltan.length}
  <p class="vacio">No te falta ninguna. 🎉</p>
{:else}
  <div class="resumen">
    <div class="cifra"><b>{faltan.length}</b><span>cartas que te faltan</span></div>
    <button class="compartir" data-compartir onclick={compartir}>Compartir la lista</button>
    <p class="nota">Se manda como texto, con las primeras {Math.min(faltan.length, TOPE_LISTA)}: sirve para enseñarla en la tienda o pedirla por WhatsApp.</p>
  </div>

  <Grupos cartas={mostradas} {abrir} />

  {#if quedan > 0}
    <button class="mas" onclick={() => (tope += TANDA)}>Ver {Math.min(TANDA, quedan)} más · quedan {quedan}</button>
  {/if}
{/if}

<style>
  .chips { display: flex; gap: 7px; overflow-x: auto; scrollbar-width: none; padding: 1px 1px 3px; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button {
    flex: none; padding: 8px 15px; border: 0; border-radius: 999px; font-size: 13.5px; font-weight: 800;
    background: var(--papel); color: var(--tinta-2); box-shadow: var(--sombra-1); transition: background .2s, color .2s, transform .12s;
  }
  .chips button:active { transform: scale(.95); }
  .chips button.v { background: linear-gradient(180deg, var(--azul-alto), var(--azul-bajo)); color: #fff; }

  .resumen { background: var(--papel); border-radius: var(--radio-l); box-shadow: var(--sombra-1); padding: 16px 18px; display: grid; gap: 10px; }
  .cifra { display: flex; align-items: baseline; gap: 9px; }
  .cifra b { font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
  .cifra span { font-size: 14px; font-weight: 600; color: var(--tinta-3); }
  .compartir {
    min-height: 48px; border: 0; border-radius: 14px; font-size: 15.5px; font-weight: 800; color: #fff;
    background: linear-gradient(180deg, #2fb96b, #178048); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 4px 12px rgba(23,128,72,.3);
  }
  .compartir:active { transform: scale(.98); }
  .nota { margin: 0; font-size: 12.5px; color: var(--tinta-3); line-height: 1.4; }
  .vacio { text-align: center; padding: 48px 0; font-weight: 800; font-size: 18px; color: #fff; text-shadow: 0 1px 8px rgba(10,40,100,.4); }
  .mas { min-height: 50px; border: 0; border-radius: 16px; background: var(--papel); box-shadow: var(--sombra-1); font-size: 15px; font-weight: 800; color: var(--azul); }
  .mas:active { transform: scale(.98); }
</style>
