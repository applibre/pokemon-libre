<script lang="ts">
  import { avisos, responder } from './mensajes.svelte'
</script>

<div class="avisos" role="status" aria-live="polite">
  {#each avisos.lista as a (a.id)}
    <div class="aviso {a.tono}">{a.texto}</div>
  {/each}
</div>

{#if avisos.pregunta}
  {@const q = avisos.pregunta}
  <div class="velo" onclick={() => responder(false)} role="presentation"></div>
  <div class="pregunta" role="alertdialog" aria-modal="true" aria-labelledby="q-titulo">
    <h2 id="q-titulo">{q.titulo}</h2>
    {#if q.sub}<p>{q.sub}</p>{/if}
    <div class="botones">
      <button onclick={() => responder(false)}>Cancelar</button>
      <button class:peligro={q.peligro} class="si" onclick={() => responder(true)}>{q.aceptar}</button>
    </div>
  </div>
{/if}

<style>
  .avisos {
    position: fixed; z-index: 70; left: 50%; translate: -50% 0; bottom: calc(96px + env(safe-area-inset-bottom));
    display: grid; gap: 8px; justify-items: center; pointer-events: none; width: min(420px, calc(100vw - 24px));
  }
  .aviso {
    padding: 11px 18px; border-radius: 14px; font-size: 14px; font-weight: 700; color: #fff;
    background: #1c2a49; box-shadow: var(--sombra-2); animation: entra .28s cubic-bezier(.2, .9, .3, 1.2) both;
  }
  .aviso.bueno { background: #178048; }
  .aviso.malo { background: #b7402a; }
  @keyframes entra { from { opacity: 0; translate: 0 12px; scale: .94; } }

  .velo { position: fixed; inset: 0; z-index: 80; background: rgba(9, 22, 52, .58); backdrop-filter: blur(6px); animation: fundido .2s both; }
  @keyframes fundido { from { opacity: 0; } }
  .pregunta {
    position: fixed; z-index: 81; left: 50%; top: 50%; translate: -50% -50%; width: min(380px, calc(100vw - 32px));
    padding: 20px 20px 16px; border-radius: var(--radio-l); background: var(--papel); box-shadow: var(--sombra-2);
    animation: abre .28s cubic-bezier(.2, .9, .25, 1) both;
  }
  @keyframes abre { from { opacity: 0; scale: .93; } }
  h2 { margin: 0 0 6px; font-size: 19px; font-weight: 800; letter-spacing: -.01em; }
  p { margin: 0 0 16px; font-size: 14.5px; color: var(--tinta-2); line-height: 1.45; }
  .botones { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .botones button { min-height: 46px; border: 0; border-radius: 13px; font-size: 15px; font-weight: 800; background: var(--hueco); color: var(--tinta); }
  .botones .si { background: var(--azul); color: #fff; }
  .botones .si.peligro { background: #c2412b; }
  .botones button:active { transform: scale(.97); }
</style>
