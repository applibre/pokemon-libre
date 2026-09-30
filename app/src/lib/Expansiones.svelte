<!-- Las expansiones como baldosas con su logo oficial, agrupadas por SERIE como
     en Pokellector (cada serie con su cinta y su logo) y de la más antigua a
     la más moderna. -->
<script lang="ts">
  import Cinta from './Cinta.svelte'
  import Logo from './Logo.svelte'
  import { app, delIdioma, progreso, logos, type Set } from './store.svelte'

  let { abrir }: { abrir: (id: string) => void } = $props()

  type Fila = { id: string; set: Set; total: number; tengo: number; parte: number }

  const bloques = $derived.by(() => {
    const cartasPorSet: Record<string, ReturnType<typeof delIdioma>> = {}
    for (const c of delIdioma()) (cartasPorSet[c.s] ??= []).push(c)

    const filas: Fila[] = Object.entries(cartasPorSet)
      .filter(([id]) => app.sets[id])
      .map(([id, cs]) => ({ id, set: app.sets[id], ...progreso(cs) }))
      .sort((a, b) => (a.set.o ?? 9999) - (b.set.o ?? 9999))

    /* Las inglesas se ordenan por fecha. Las japonesas no traen fecha, pero
       Pokellector las lista de la más nueva a la más vieja, en series y
       dentro de cada serie: se usa su orden, al revés. */
    if (app.idioma === 'ja') {
      filas.sort((a, b) => {
        const x = logos.series[a.id], y = logos.series[b.id]
        if (!x || !y) return (x ? 0 : 1) - (y ? 0 : 1)
        return y.s - x.s || y.p - x.p
      })
    }

    // por serie; las que no tienen serie conocida, al final y juntas
    const grupos = new Map<string, { titulo: string; slug: string; filas: Fila[]; orden: number }>()
    for (const f of filas) {
      const s = logos.series[f.id]
      const clave = s?.serie ?? '—'
      if (!grupos.has(clave)) grupos.set(clave, { titulo: s?.serie ?? 'Otras expansiones', slug: s?.slug ?? '', filas: [], orden: grupos.size })
      grupos.get(clave)!.filas.push(f)
    }
    return [...grupos.values()]
      .sort((a, b) => (a.titulo === 'Otras expansiones' ? 1 : b.titulo === 'Otras expansiones' ? -1 : a.orden - b.orden))
  })

  const color = $derived(app.idioma === 'ja' ? ('naranja' as const) : ('azul' as const))
</script>

{#each bloques as b (b.titulo)}
  <section class="panel">
    <Cinta {color} titulo={b.titulo} sub="{b.filas.length} expansiones">
      {#snippet icono()}
        {#if b.slug && logos.ids.has('series/' + b.slug)}
          <img class="serie" src="/logos/series/{b.slug}.webp" alt="" />
        {:else}
          <span class="serie-vacia"></span>
        {/if}
      {/snippet}
    </Cinta>
    <div class="rejilla">
      {#each b.filas as f, i (f.id)}
        <button class="baldosa" style="--r:{Math.min(i, 12) * 24}ms" onclick={() => abrir(f.id)}>
          <span class="logo"><Logo id={f.id} nombre={f.set.n} alto={46} respaldo="icono" /></span>
          <span class="nombre">{f.set.n}</span>
          <span class="via"><i style="width:{f.parte * 100}%"></i></span>
          <span class="cuenta">{f.tengo}/{f.total}</span>
          {#if f.set.cod}<span class="cod">{f.set.cod}</span>{/if}
        </button>
      {/each}
    </div>
  </section>
{/each}

<style>
  .panel { background: var(--papel); border-radius: var(--radio-l); box-shadow: var(--sombra-1); overflow: hidden; }
  .rejilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 12px; }
  @media (min-width: 520px) { .rejilla { grid-template-columns: repeat(3, 1fr); } }

  .serie { height: 30px; width: auto; max-width: 96px; object-fit: contain; display: block; }
  .serie-vacia { display: block; width: 28px; height: 28px; border-radius: 50%; background: #dfe6f3; }

  .baldosa {
    position: relative; display: grid; grid-template-rows: 62px auto auto auto; justify-items: center; align-items: center;
    gap: 4px; padding: 10px 10px 10px; min-height: 132px; text-align: center; min-width: 0;
    border: 1px solid var(--linea); border-radius: var(--radio-m);
    background: linear-gradient(180deg, #fff 0%, var(--hueco) 100%);
    touch-action: manipulation;
    animation: sube .42s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--r);
    transition: transform .18s cubic-bezier(.2,.8,.2,1), border-color .15s;
  }
  .baldosa:active { transform: scale(.97); border-color: var(--azul); }
  @keyframes sube { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
  .logo { display: grid; place-items: center; width: 100%; height: 62px; }
  .nombre {
    font-size: 11.5px; font-weight: 700; color: var(--tinta-2); line-height: 1.2; max-width: 100%; overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .via { width: 70%; height: 4px; border-radius: 999px; background: var(--linea); overflow: hidden; }
  .via i { display: block; height: 100%; background: var(--oro); border-radius: inherit; }
  .cuenta { font-size: 11px; font-weight: 700; color: var(--tinta-3); }
  .cod {
    position: absolute; right: 7px; bottom: 6px; font-size: 9px; font-weight: 800; letter-spacing: .04em;
    color: #fff; background: #3d4660; padding: 2px 5px; border-radius: 4px;
  }
</style>
