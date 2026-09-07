/* ===========================================================
   Pokémon Libre · arranque y navegación
   =========================================================== */
const App = (() => {
  'use strict';

  const { $, $$, tosti } = UI;

  const PANTALLAS = ['inicio', 'cartas', 'faltan', 'ajustes'];
  let actual = null;

  function ir(nombre) {
    PANTALLAS.forEach((p) => $(`#p-${p}`).classList.toggle('viva', p === nombre));

    // la barra de abajo solo marca las dos secciones que tiene
    $$('.nav button').forEach((b) => {
      const suya = b.dataset.ir === nombre || (nombre === 'cartas' && b.dataset.ir === 'inicio');
      b.classList.toggle('viva', suya);
      if (suya) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    actual = nombre;
    if (nombre !== 'cartas') marcarDireccion(nombre);
    if (nombre === 'inicio') Inicio.pintar();
    if (nombre === 'cartas') Cartas.pintar();
    if (nombre === 'faltan') Faltan.pintar();
    if (nombre === 'ajustes') Ajustes.pintar();
  }

  /* ---------- la dirección ----------
     #gengar abre las cartas de Gengar; #faltan y #ajustes, lo suyo. */

  function desdeLaDireccion() {
    const d = decodeURIComponent(location.hash.replace(/^#/, '')).trim();
    if (!d) { ir('inicio'); return; }
    if (d === 'faltan' || d === 'ajustes' || d === 'inicio') { ir(d); return; }
    if (Estado.pokemonPorId(d)) { Cartas.abrir(d); return; }
    ir('inicio');
  }

  const marcarDireccion = (d) => {
    const nueva = d && d !== 'inicio' ? `#${d}` : ' ';
    if (location.hash.replace(/^#/, '') !== (d === 'inicio' ? '' : d)) {
      history.replaceState(null, '', nueva === ' ' ? location.pathname : nueva);
    }
  };

  function aplicarTema() {
    const t = Estado.leer().ajustes.tema || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', t);

    const oscuro = t === 'oscuro'
      || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('meta[name="theme-color"]').forEach((m) => m.remove());
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = oscuro ? '#100F1C' : '#EEF0F4';
    document.head.appendChild(m);
  }

  async function iniciar() {
    aplicarTema();

    try {
      await Estado.cargarCatalogo();
    } catch (e) {
      $('#cargando').innerHTML =
        '<p style="max-width:22rem;text-align:center;line-height:1.5">'
        + 'No se ha podido abrir el catálogo de cartas.<br>Recarga la página.</p>';
      return;
    }

    Inicio.iniciar();
    Cartas.iniciar();
    Faltan.iniciar();
    Ajustes.iniciar();

    $$('.nav button').forEach((b) => { b.onclick = () => ir(b.dataset.ir); });

    Almacen.alQuedarseSinEspacio(() => {
      tosti('El navegador se ha quedado sin espacio. Guarda una copia desde Ajustes', 'mala');
    });
    Almacen.pedirPermanencia();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Estado.guardarYa();
    });

    $('#cargando').classList.add('fuera');

    /* La dirección recuerda dónde estabas: al recargar no vuelves al
       principio, y se puede enviar el enlace de un Pokémon concreto. */
    window.addEventListener('hashchange', desdeLaDireccion);
    desdeLaDireccion();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);

  return { ir, aplicarTema, marcarDireccion, pantalla: () => actual };
})();
