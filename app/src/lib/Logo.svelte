<!-- El logo oficial de una expansión. Si no lo tenemos, un emblema neutro o el
     nombre en texto: nunca un hueco roto ni una petición que da 404. -->
<script lang="ts">
  import { logos } from './store.svelte'
  let { id, nombre, alto = 44, respaldo = 'texto' }: {
    id: string; nombre: string; alto?: number; respaldo?: 'texto' | 'icono'
  } = $props()
  const hay = $derived(logos.ids.has(id))
</script>

{#if hay}
  <img src="/logos/{id}.webp" alt={nombre} style="height:{alto}px;max-width:100%;width:auto;object-fit:contain" loading="lazy" />
{:else if respaldo === 'icono'}
  <span class="ico" style="width:{alto * 0.7}px;height:{alto * 0.7}px" aria-hidden="true"></span>
{:else}
  <span class="txt" style="font-size:{Math.max(11, alto * 0.3)}px">{nombre}</span>
{/if}

<style>
  .txt { font-weight: 800; letter-spacing: -.01em; color: var(--tinta-2); text-align: center; line-height: 1.1; }
  .ico {
    display: block; border-radius: 50%; opacity: .55;
    background: linear-gradient(180deg, #c9d3e4 0 44%, #9aa7c0 44% 56%, #e3e9f4 56%);
    box-shadow: 0 0 0 2px #9aa7c0;
  }
</style>
