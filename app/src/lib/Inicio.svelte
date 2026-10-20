<!-- Inicio: tus Pokémon como baldosas con su carta, no como una tabla de números. -->
<script lang="ts">
  import { rutas } from './rutas'
  import Cinta from './Cinta.svelte'
  import Novedades from './Novedades.svelte'
  import { app, cartasDe, progreso } from './store.svelte'

  let { abrir }: { abrir: (id: string) => void } = $props()

  const COLOR: Record<string, string> = {
    fuego: '#ec6a2c', planta: '#3fa75a', agua: '#3a8ad8', electrico: '#eab21b', fantasma: '#7a55b8', normal: '#8892a8',
    entrenador: '#d9601a',
  }
  // los Entrenadores son cientos: se enseñan los que más cartas tienen y el resto a un toque
  const TANDA_ENT = 12
  let verTodosEnt = $state(false)

  const bloques = $derived.by(() => {
    const filas = app.pokemon.map((p) => {
      const cartas = cartasDe(p.id)
      return { p, cartas, ...progreso(cartas), color: COLOR[p.tipo] ?? COLOR.normal }
    }).filter((x) => x.total > 0)
    const ents = filas.filter((x) => x.p.ent).sort((a, b) => b.total - a.total || a.p.nombre.localeCompare(b.p.nombre))
    return [
      { titulo: 'Mis Pokémon', color: 'azul' as const, items: filas.filter((x) => x.p.principal && !x.p.ent), ent: false },
      { titulo: 'Sus familias', color: 'verde' as const, items: filas.filter((x) => !x.p.principal && !x.p.ent), ent: false },
      { titulo: 'Entrenadores', color: 'naranja' as const, items: ents, ent: true },
    ].filter((b) => b.items.length)
  })
  // el resumen de arriba cuenta tus Pokémon; los Entrenadores llevan el suyo en su cinta
  const pokes = $derived(bloques.filter((b) => !b.ent).flatMap((b) => b.items))
  const total = $derived(pokes.reduce((a, x) => a + x.total, 0))
  const tengo = $derived(pokes.reduce((a, x) => a + x.tengo, 0))
  const sub = (b: (typeof bloques)[number]) => {
    if (!b.ent) return `${b.items.length} Pokémon`
    const t = b.items.reduce((a, x) => a + x.total, 0), h = b.items.reduce((a, x) => a + x.tengo, 0)
    return `${b.items.length} personajes · ${h} de ${t} cartas`
  }
</script>

<Novedades />

<div class="resumen">
  <div class="cifra"><b>{tengo}</b><span>de {total} cartas</span></div>
  <div class="barra"><i style="width:{total ? (tengo / total) * 100 : 0}%"></i></div>
</div>

{#each bloques as b (b.titulo)}
  <section class="panel">
    <Cinta color={b.color} titulo={b.titulo} sub={sub(b)} />
    <div class="rejilla">
      {#each b.ent && !verTodosEnt ? b.items.slice(0, TANDA_ENT) : b.items as x, i (x.p.id)}
        <button class="baldosa" style="--c:{x.color}; --r:{i * 28}ms" onclick={() => abrir(x.p.id)}>
          <span class="mazo">
            {#if x.cartas[1]}<img class="atras" src={rutas.carta(x.cartas[1].id)} alt="" loading="lazy" />{/if}
            <img class="frente" src={rutas.carta(x.cartas[0].id)} alt="" loading="lazy" />
          </span>
          <span class="nombre">{x.p.nombre}</span>
          <span class="cuenta"><b>{x.tengo}</b> / {x.total}</span>
          <span class="via"><i style="width:{x.parte * 100}%"></i></span>
        </button>
      {/each}
    </div>
    {#if b.ent && b.items.length > TANDA_ENT}
      <button class="mas" onclick={() => (verTodosEnt = !verTodosEnt)}>
        {verTodosEnt ? 'Ver menos' : `Ver los ${b.items.length} personajes`}
      </button>
    {/if}
  </section>
{/each}

<style>
  .resumen {
    background: var(--papel); border-radius: var(--radio-l); box-shadow: var(--sombra-1);
    padding: 16px 18px 18px; display: grid; gap: 10px;
  }
  .cifra { display: flex; align-items: baseline; gap: 8px; }
  .cifra b { font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
  .cifra span { font-size: 14px; color: var(--tinta-3); font-weight: 600; }
  .barra { height: 7px; border-radius: 999px; background: var(--hueco); overflow: hidden; }
  .barra i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #f6c33a, #e9a10c); transition: width .5s cubic-bezier(.2,.8,.2,1); }

  .panel { background: var(--papel); border-radius: var(--radio-l); box-shadow: var(--sombra-1); overflow: hidden; }
  .mas {
    display: block; width: calc(100% - 24px); margin: 0 12px 14px; padding: 12px; border: 0; border-radius: var(--radio-m);
    background: var(--hueco); color: var(--tinta); font: inherit; font-weight: 800; font-size: 15px;
  }
  .mas:active { transform: scale(.98); }
  .rejilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(146px, 1fr)); gap: 10px; padding: 12px; }

  .baldosa {
    position: relative; display: grid; justify-items: center; gap: 2px; padding: 12px 10px 12px;
    border: 1px solid var(--linea); border-radius: var(--radio-m); overflow: hidden; text-align: center;
    background:
      radial-gradient(90% 70% at 50% 18%, color-mix(in srgb, var(--c) 26%, var(--papel)) 0%, transparent 72%),
      linear-gradient(180deg, var(--papel), var(--hueco));
    touch-action: manipulation;
    animation: sube .45s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--r);
    transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s;
  }
  .baldosa:active { transform: scale(.97); }
  @keyframes sube { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }

  /* dos cartas abiertas en abanico, centradas */
  .mazo { position: relative; display: block; width: 92px; height: 104px; margin-bottom: 8px; }
  .mazo img { position: absolute; top: 0; width: 66px; border-radius: 4px; box-shadow: 0 3px 10px rgba(20,45,90,.28); }
  .frente { left: 50%; translate: -50% 0; z-index: 2; rotate: -4deg; transition: rotate .3s cubic-bezier(.2,.8,.2,1); }
  .atras { left: 50%; translate: -50% 0; rotate: 9deg; transform: translateX(16px) scale(.94); z-index: 1; filter: saturate(.85); }
  .baldosa:active .frente { rotate: 0deg; }

  .nombre { font-size: 16px; font-weight: 800; letter-spacing: -.01em; }
  .cuenta { font-size: 12.5px; color: var(--tinta-3); font-weight: 600; }
  .cuenta b { color: var(--tinta); }
  .via { width: 100%; height: 5px; margin-top: 6px; border-radius: 999px; background: color-mix(in srgb, var(--c) 16%, #dde6f2); overflow: hidden; }
  .via i { display: block; height: 100%; border-radius: inherit; background: var(--c); }
</style>
