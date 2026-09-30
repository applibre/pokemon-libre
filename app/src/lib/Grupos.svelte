<!-- Las cartas de un Pokémon (o de una expansión), agrupadas por expansión: cada
     grupo lleva su cinta con el logo oficial y sus celdas iguales y centradas. -->
<script lang="ts">
  import Cinta from './Cinta.svelte'
  import Celda from './Celda.svelte'
  import Logo from './Logo.svelte'
  import { porSet, progreso, type Carta } from './store.svelte'

  let { cartas, abrir }: { cartas: Carta[]; abrir: (c: Carta, img: HTMLElement) => void } = $props()
  const grupos = $derived(porSet(cartas))
</script>

{#each grupos as g (g.id)}
  {@const p = progreso(g.cartas)}
  <section class="panel">
    <Cinta color={g.set.ja ? 'naranja' : 'azul'} titulo={g.set.n} sub="{p.tengo} de {p.total}{g.set.rel ? ' · ' + g.set.rel.slice(0, 4) : ''}">
      {#snippet icono()}<Logo id={g.id} nombre={g.set.n} alto={28} />{/snippet}
    </Cinta>
    <div class="celdas">
      {#each g.cartas as c, i (c.id)}
        <Celda carta={c} {abrir} retraso={Math.min(i, 14) * 22} />
      {/each}
    </div>
  </section>
{/each}

<style>
  .panel { background: var(--papel); border-radius: var(--radio-l); box-shadow: var(--sombra-1); overflow: hidden; }
  .celdas {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 14px 10px;
    padding: 16px 12px 18px;
  }
</style>
