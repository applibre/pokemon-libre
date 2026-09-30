<!-- Inicio: tus Pokémon como baldosas con su carta, no como una tabla de números. -->
<script lang="ts">
  import { rutas } from './rutas'
  import Cinta from './Cinta.svelte'
  import { app, cartasDe, progreso } from './store.svelte'

  let { abrir }: { abrir: (id: string) => void } = $props()

  const COLOR: Record<string, string> = {
    fuego: '#ec6a2c', planta: '#3fa75a', agua: '#3a8ad8', electrico: '#eab21b', fantasma: '#7a55b8', normal: '#8892a8',
  }

  const bloques = $derived.by(() => {
    const filas = app.pokemon.map((p) => {
      const cartas = cartasDe(p.id)
      return { p, cartas, ...progreso(cartas), color: COLOR[p.tipo] ?? COLOR.normal }
    }).filter((x) => x.total > 0)
    return [
      { titulo: 'Mis Pokémon', color: 'azul' as const, items: filas.filter((x) => x.p.principal) },
      { titulo: 'Sus familias', color: 'verde' as const, items: filas.filter((x) => !x.p.principal) },
    ].filter((b) => b.items.length)
  })
  const total = $derived(bloques.flatMap((b) => b.items).reduce((a, x) => a + x.total, 0))
  const tengo = $derived(bloques.flatMap((b) => b.items).reduce((a, x) => a + x.tengo, 0))
</script>

<div class="resumen">
  <div class="cifra"><b>{tengo}</b><span>de {total} cartas</span></div>
  <div class="barra"><i style="width:{total ? (tengo / total) * 100 : 0}%"></i></div>
</div>

{#each bloques as b (b.titulo)}
  <section class="panel">
    <Cinta color={b.color} titulo={b.titulo} sub="{b.items.length} Pokémon" />
    <div class="rejilla">
      {#each b.items as x, i (x.p.id)}
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
