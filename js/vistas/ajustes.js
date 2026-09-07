/* ===========================================================
   Pokémon Libre · ajustes
   Lo justo: qué se ve, y sobre todo la copia de seguridad, que es
   la única red que hay cuando no existe servidor.
   =========================================================== */
const Ajustes = (() => {
  'use strict';

  const { $, esc, tosti, confirmar } = UI;

  function iniciar() {
    $('#ajustes-volver').onclick = () => App.ir('inicio');
    Estado.escuchar(() => { if ($('#p-ajustes').classList.contains('viva')) pintar(); });
  }

  function pintar() {
    const d = Estado.leer();
    const col = d.coleccion;
    const marcadas = Object.keys(col).length;
    const ejemplares = Object.values(col).reduce(
      (a, c) => a + Object.values(c).reduce((x, n) => x + n, 0), 0);
    const man = Estado.man() || {};

    $('#ajustes-cuerpo').innerHTML = `
      <div class="tarjeta">
        <h3>Qué se ve</h3>
        <label class="fila">
          <span>Preevoluciones<small>Gastly, Haunter, Pichu, Raichu y Munchlax</small></span>
          <input type="checkbox" class="interruptor" id="ver-familias" ${d.ajustes.verFamilias ? 'checked' : ''}>
        </label>
        <label class="fila">
          <span>Precios orientativos<small>Europa y EE. UU., del día que se generó el catálogo</small></span>
          <input type="checkbox" class="interruptor" id="ver-precios" ${d.ajustes.verPrecios ? 'checked' : ''}>
        </label>
      </div>

      <div class="tarjeta">
        <h3>Tus datos</h3>
        <div class="aviso" style="margin-bottom:12px">
          <span>🔒</span>
          <span>Tu colección vive solo en este dispositivo. No hay cuenta ni servidor, y nadie
          más puede verla. <b>Por eso la copia importa:</b> si borras los datos del navegador,
          se va. La app oficial de Pokémon cerró en 2023 y se llevó las colecciones de todos;
          aquí eso no puede pasar, pero la copia la tienes que guardar tú.</span>
        </div>
        <div class="fila"><span>Cartas marcadas</span><span class="v">${marcadas}</span></div>
        <div class="fila"><span>Ejemplares en total</span><span class="v">${ejemplares}</span></div>
        <div class="fila"><span>Última copia</span><span class="v">${d.ultimaCopia ? esc(d.ultimaCopia) : 'ninguna'}</span></div>
        <button class="btn" data-copia style="margin-top:10px">Guardar una copia</button>
        <button class="btn" data-restaurar>Restaurar desde una copia</button>
      </div>

      <div class="tarjeta">
        <h3>Aspecto</h3>
        <div class="segmentos">
          ${[['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) =>
            `<button data-tema="${v}" class="${(d.ajustes.tema || 'auto') === v ? 'viva' : ''}">${t}</button>`).join('')}
        </div>
      </div>

      <div class="tarjeta">
        <h3>El catálogo</h3>
        <div class="fila"><span>Cartas</span><span class="v">${man.cartas || 0}</span></div>
        <div class="fila"><span>Colecciones</span><span class="v">${man.sets || 0}</span></div>
        <div class="fila"><span>Precios del</span><span class="v">${esc(man.preciosDe || man.generado || '—')}</span></div>
        <p class="pista chica">Las cartas y sus imágenes viajan dentro de la app: se ven sin
        internet y no dependen de ningún servicio que pueda cerrar.</p>
      </div>

      <div class="tarjeta">
        <h3>Sobre Pokémon Libre</h3>
        <p class="pista">Software libre de <b>applibre</b>. Gratis de verdad: sin anuncios,
        sin cuenta y sin suscripción.</p>
        <p class="pista chica">Proyecto de aficionado, sin relación con Nintendo, Creatures,
        GAME FREAK ni The Pokémon Company. Las imágenes de las cartas son de sus autores y se
        muestran solo para llevar el control de una colección personal.</p>
        <button class="btn peligro" data-borrar style="margin-top:10px">Borrar mi colección</button>
      </div>`;

    enganchar();
  }

  function enganchar() {
    const c = $('#ajustes-cuerpo');

    $('#ver-familias', c).onchange = (e) => {
      Estado.cambiar((d) => { d.ajustes.verFamilias = e.target.checked; });
      tosti(e.target.checked ? 'Preevoluciones incluidas' : 'Solo tus doce Pokémon');
    };
    $('#ver-precios', c).onchange = (e) => {
      Estado.cambiar((d) => { d.ajustes.verPrecios = e.target.checked; });
    };

    c.querySelectorAll('[data-tema]').forEach((b) => {
      b.onclick = () => {
        Estado.cambiar((d) => { d.ajustes.tema = b.dataset.tema; });
        App.aplicarTema();
      };
    });

    $('[data-copia]', c).onclick = copia;
    $('[data-restaurar]', c).onclick = restaurar;
    $('[data-borrar]', c).onclick = borrar;
  }

  /* ---------- copia de seguridad ---------- */

  function copia() {
    const d = Estado.leer();
    const hoy = new Date().toISOString().slice(0, 10);
    const texto = JSON.stringify({
      app: 'pokemon-libre',
      exportado: hoy,
      catalogo: (Estado.man() || {}).version || null,
      coleccion: d.coleccion,
      ajustes: d.ajustes,
    }, null, 1);

    const blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokemon-libre-${hoy}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    Estado.cambiar((x) => { x.ultimaCopia = hoy; });
    tosti('Copia guardada', 'buena');
  }

  function restaurar() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      let d;
      try { d = JSON.parse(await f.text()); } catch (_) {
        tosti('El fichero no se puede leer', 'mala'); return;
      }
      if (!d || typeof d !== 'object' || !d.coleccion) {
        tosti('El fichero no parece una copia de Pokémon Libre', 'mala'); return;
      }
      const cuantas = Object.keys(d.coleccion).length;
      if (!await confirmar({
        titulo: `¿Restaurar ${cuantas} cartas?`,
        sub: 'Sustituirá la colección que tienes ahora en la app.',
        aceptar: 'Sí, restaurar', peligro: true,
      })) return;

      Estado.reemplazar(d);
      App.aplicarTema();
      tosti('Colección restaurada', 'buena');
      App.ir('inicio');
    };
    inp.click();
  }

  async function borrar() {
    if (!await confirmar({
      titulo: '¿Borrar tu colección?',
      sub: 'Se pierden todas las marcas. No se puede deshacer y no hay copia en ningún servidor.',
      aceptar: 'Borrar todo', peligro: true,
    })) return;
    Estado.reiniciar();
    location.reload();
  }

  return { iniciar, pintar };
})();
