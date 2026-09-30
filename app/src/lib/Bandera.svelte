<!-- Banderas dibujadas en SVG: los emojis de bandera no se pintan en Windows. -->
<script lang="ts">
  let { pais, tam = 20 }: { pais: 'en' | 'ja'; tam?: number } = $props()
</script>

{#if pais === 'en'}
  <svg width={tam * 1.5} height={tam} viewBox="0 0 30 20" aria-hidden="true" style="border-radius:4px;display:block;flex:none">
    <rect width="30" height="20" fill="#fff" />
    {#each [0, 2, 4, 6, 8, 10, 12] as i}<rect y={(i * 20) / 13} width="30" height={20 / 13} fill="#c8323e" />{/each}
    <rect width="13" height="10.77" fill="#2b3f8a" />
    {#each [[2, 2], [5, 2], [8, 2], [11, 2], [3.5, 4.4], [6.5, 4.4], [9.5, 4.4], [2, 6.8], [5, 6.8], [8, 6.8], [11, 6.8], [3.5, 9], [6.5, 9], [9.5, 9]] as [x, y]}
      <circle cx={x} cy={y} r=".65" fill="#fff" />
    {/each}
  </svg>
{:else}
  <svg width={tam * 1.5} height={tam} viewBox="0 0 30 20" aria-hidden="true" style="border-radius:4px;display:block;flex:none">
    <rect width="30" height="20" fill="#fff" />
    <circle cx="15" cy="10" r="5.6" fill="#c8323e" />
  </svg>
{/if}
