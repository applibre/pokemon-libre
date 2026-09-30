<!-- El aviso de novedades: el buscador semanal encontró cartas nuevas de tus
     Pokémon y te pregunta, expansión por expansión, si las añades. Hasta que
     no dices que sí, no entran en tu colección. -->
<script lang="ts">
  import { rutas } from './rutas'
  import { app } from './store.svelte'
  import { avisar } from './mensajes.svelte'
  import Bandera from './Bandera.svelte'

  const grupos = $derived(app.pendientes)

  function decidir(ids: string[], si: boolean, nombre: string) {
    app.decidir(ids, si)
    avisar(si ? `Añadidas ${ids.length} cartas de ${nombre}` : `${nombre}: descartada`, si ? 'bueno' : 'normal')
  }
</script>

{#if grupos.length}
  <section class="novedades" aria-label="Actualizaciones disponibles">
    {#each grupos as g (g.id)}
      <article class="novedad">
        <div class="fotos" aria-hidden="true">
          {#each g.cartas.slice(0, 3) as c, i (c.id)}
            <img src={rutas.carta(c.id)} alt="" style="--i:{i}" loading="lazy" />
          {/each}
        </div>
        <div class="txt">
          <span class="etq">Actualización disponible</span>
          <b>{g.set.n}</b>
          <span class="sub"><Bandera pais={g.set.ja ? 'ja' : 'en'} tam={13} /> {g.cartas.length} {g.cartas.length === 1 ? 'carta nueva' : 'cartas nuevas'} de tus Pokémon</span>
        </div>
        <div class="botones">
          <button class="si" data-novedad-si onclick={() => decidir(g.cartas.map((c) => c.id), true, g.set.n)}>Añadir</button>
          <button class="no" data-novedad-no onclick={() => decidir(g.cartas.map((c) => c.id), false, g.set.n)}>Descartar</button>
        </div>
      </article>
    {/each}
  </section>
{/if}

<style>
  .novedades { display: grid; gap: 10px; margin: 0 0 14px; }
  .novedad {
    display: grid; grid-template-columns: auto 1fr; gap: 10px 12px; align-items: center;
    padding: 12px; border-radius: 18px; background: var(--papel); color: var(--tinta);
    border: 2px solid var(--oro); box-shadow: 0 6px 18px rgba(201, 143, 10, .22);
    animation: entra .45s cubic-bezier(.2, .8, .2, 1) both;
  }
  @keyframes entra { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: none; } }
  .fotos { position: relative; width: 62px; height: 66px; }
  .fotos img {
    position: absolute; top: 2px; left: calc(var(--i) * 11px); width: 40px; aspect-ratio: 245 / 342;
    border-radius: 3px; box-shadow: 0 2px 6px rgba(20, 45, 90, .3);
    transform: rotate(calc((var(--i) - 1) * 7deg));
  }
  .txt { display: grid; gap: 2px; min-width: 0; }
  .etq { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #b07a06; }
  .txt b { font-size: 17px; line-height: 1.2; text-wrap: balance; }
  .sub { display: flex; align-items: center; gap: 6px; font-size: 13px; opacity: .75; }
  .botones { grid-column: 1 / -1; display: grid; grid-template-columns: 2fr 1fr; gap: 8px; }
  .botones button { min-height: 44px; border: 0; border-radius: 12px; font-size: 15px; font-weight: 800; transition: transform .12s; }
  .botones button:active { transform: scale(.97); }
  .si { background: linear-gradient(180deg, var(--azul-alto), var(--azul-bajo)); color: #fff; }
  .no { background: var(--hueco); color: var(--tinta); }
</style>
