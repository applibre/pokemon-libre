<!-- La cinta de color de las cabeceras: el gesto de Pokellector, en CSS. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  let { color = 'azul', titulo, sub = '', icono, lado }: {
    color?: 'azul' | 'verde' | 'naranja'; titulo: string; sub?: string
    icono?: Snippet; lado?: Snippet
  } = $props()
</script>

<header class="cinta {color}">
  {#if icono}<span class="med">{@render icono()}</span>{/if}
  <span class="txt">
    <b>{titulo}</b>
    {#if sub}<small>{sub}</small>{/if}
  </span>
  {#if lado}<span class="lado">{@render lado()}</span>{/if}
</header>

<style>
  .cinta {
    display: flex; align-items: center; gap: 12px; min-height: 52px;
    padding: 8px 16px; color: #fff;
    background: linear-gradient(180deg, var(--alto) 0%, var(--bajo) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 0 rgba(0,0,0,.14);
  }
  .azul   { --alto: #4f8df0; --bajo: #2c66cf; }
  .verde  { --alto: #2fb96b; --bajo: #178048; }
  .naranja{ --alto: #f58a3c; --bajo: #d9601a; }
  .med {
    flex: none; display: grid; place-items: center; height: 38px; min-width: 62px; max-width: 110px;
    padding: 3px 8px; background: #fff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,.2);
  }
  .txt { display: grid; min-width: 0; flex: 1; }
  b { font-size: 17px; font-weight: 800; letter-spacing: -.01em; line-height: 1.15; overflow-wrap: anywhere; }
  small { font-size: 12.5px; opacity: .9; font-weight: 600; }
  .lado { flex: none; }
</style>
