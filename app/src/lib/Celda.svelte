<!-- Una carta en su celda: siempre del mismo tamaño y centrada, con su placa
     «#10 - Nombre». Tocar la carta la abre; el círculo la marca. -->
<script lang="ts">
  import { rutas } from './rutas'
  import { tengo, alternar, numeroImpreso, type Carta } from './store.svelte'
  let { carta, abrir, retraso = 0 }: { carta: Carta; abrir: (c: Carta, img: HTMLElement) => void; retraso?: number } = $props()
  const mia = $derived(tengo(carta.id))
</script>

<div class="celda" class:mia data-carta={carta.id} style="--r:{retraso}ms">
  <button class="ver" onclick={(e) => abrir(carta, e.currentTarget.querySelector('img')!)} aria-label="Abrir {carta.n} {numeroImpreso(carta)}">
    <img src={rutas.carta(carta.id)} alt="" loading="lazy" decoding="async" width="245" height="342" />
    <span class="placa">#{numeroImpreso(carta)} · {carta.n}</span>
  </button>
  <button class="check" onclick={() => alternar(carta)} aria-pressed={mia} aria-label={mia ? 'Quitar de mi colección' : 'La tengo'}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2 8.8-9" /></svg>
  </button>
  {#if carta.l === 'ja'}<span class="jp">JP</span>{/if}
</div>

<style>
  .celda {
    position: relative; width: 104px; flex: none;
    animation: sube .45s cubic-bezier(.2, .8, .2, 1) both; animation-delay: var(--r);
  }
  @keyframes sube { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
  .ver {
    display: block; position: relative; width: 100%; padding: 0; border: 0; background: none;
    border-radius: 6px; overflow: hidden; touch-action: manipulation;
    box-shadow: 0 1px 2px rgba(20,45,90,.18), 0 5px 12px rgba(20,45,90,.14);
    transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s;
  }
  .ver:active { transform: scale(.965); }
  img { width: 100%; height: auto; aspect-ratio: 245 / 342; object-fit: cover; background: var(--hueco); }
  .celda:not(.mia) img { filter: saturate(.72) brightness(.97); opacity: .9; }

  /* la placa: banda oscura sobre la parte baja, borde gris arriba y abajo */
  .placa {
    position: absolute; left: 0; right: 0; bottom: 7%; z-index: 2;
    padding: 4px 4px; text-align: center; color: #f4f6fb; font-size: 10.5px; font-weight: 700; line-height: 1.2;
    background: var(--placa); border-block: 2px solid #bfc4d1;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .mia .placa { background: linear-gradient(180deg, rgba(120, 82, 6, .9), rgba(84, 56, 2, .9)); border-color: var(--oro); color: #fff4d0; }
  .mia .ver { box-shadow: 0 0 0 2.5px var(--oro), 0 6px 16px rgba(201,143,10,.4); }

  .check {
    position: absolute; top: 5px; right: 5px; z-index: 3; width: 27px; height: 27px; padding: 0;
    border-radius: 50%; border: 1.5px solid #c3cde0; background: rgba(255,255,255,.94);
    box-shadow: 0 1px 4px rgba(20,45,90,.28);
    display: grid; place-items: center; touch-action: manipulation;
    transition: transform .18s cubic-bezier(.3, 1.6, .5, 1), background .15s, border-color .15s;
  }
  /* sin marcar: un círculo claro con su check apagado; marcado: oro */
  .check svg { width: 16px; height: 16px; fill: none; stroke: #b5c0d6; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; transition: stroke .15s; }
  .check[aria-pressed="true"] { background: var(--oro); border-color: #fff; transform: scale(1.12); }
  .check[aria-pressed="true"] svg { stroke: #4a3200; }
  .check:active { transform: scale(.9); }
  .jp {
    position: absolute; top: 6px; left: 6px; z-index: 3; font-size: 9px; font-weight: 800; letter-spacing: .05em;
    color: #fff; background: #c8323e; padding: 2px 5px; border-radius: 4px;
  }
</style>
