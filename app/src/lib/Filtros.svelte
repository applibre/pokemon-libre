<!-- Filtros de una lista de cartas: todas, las que faltan, las que tengo y una
     búsqueda por nombre, expansión o número. -->
<script lang="ts">
  let { estado = $bindable('todas'), texto = $bindable(''), cuenta }: {
    estado: 'todas' | 'faltan' | 'tengo'; texto: string
    cuenta: { todas: number; faltan: number; tengo: number }
  } = $props()

  const chips = $derived([
    ['todas', `Todas ${cuenta.todas}`], ['faltan', `Me faltan ${cuenta.faltan}`], ['tengo', `Tengo ${cuenta.tengo}`],
  ] as const)
</script>

<div class="filtros">
  <label class="busca">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
    <input type="search" bind:value={texto} placeholder="Nombre, expansión o número…" autocomplete="off" enterkeyhint="search" aria-label="Buscar cartas" />
  </label>
  <div class="chips" role="group" aria-label="Qué cartas ver">
    {#each chips as [v, t] (v)}
      <button class:v={estado === v} aria-pressed={estado === v} onclick={() => (estado = v)}>{t}</button>
    {/each}
  </div>
</div>

<style>
  .filtros { display: grid; gap: 8px; }
  .busca {
    display: flex; align-items: center; gap: 9px; padding: 0 14px; height: 44px; border-radius: 999px;
    background: var(--papel); box-shadow: var(--sombra-1);
  }
  .busca svg { width: 19px; height: 19px; flex: none; fill: none; stroke: var(--tinta-3); stroke-width: 2.4; stroke-linecap: round; }
  input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 16px; color: var(--tinta); }
  input::placeholder { color: var(--tinta-3); }
  .chips { display: flex; gap: 7px; overflow-x: auto; scrollbar-width: none; padding: 1px 1px 3px; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button {
    flex: none; padding: 8px 15px; border: 0; border-radius: 999px; font-size: 13.5px; font-weight: 800;
    background: var(--papel); color: var(--tinta-2); box-shadow: var(--sombra-1); transition: background .2s, color .2s, transform .12s;
  }
  .chips button:active { transform: scale(.95); }
  .chips button.v { background: linear-gradient(180deg, var(--azul-alto), var(--azul-bajo)); color: #fff; }
</style>
