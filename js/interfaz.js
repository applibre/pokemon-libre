/* ===========================================================
   Pokémon Libre · piezas de interfaz compartidas
   Avisos, hoja inferior, confirmación y atajos de DOM.
   =========================================================== */
const UI = (() => {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- aviso flotante ---------- */

  let temporizador = null;

  function tosti(mensaje, tono = '', accion = null) {
    const t = $('#tosti');
    t.innerHTML = esc(mensaje);
    if (accion) {
      const b = document.createElement('button');
      b.textContent = accion.texto;
      b.onclick = () => { accion.hacer(); ocultarTosti(); };
      t.appendChild(b);
    }
    t.className = 'tosti viva ' + tono;
    clearTimeout(temporizador);
    temporizador = setTimeout(ocultarTosti, accion ? 5200 : 2200);
  }
  const ocultarTosti = () => { $('#tosti').className = 'tosti'; };

  /* ---------- hoja inferior ---------- */

  let alCerrarHoja = null;
  let hojaEnHistorial = false;

  function hoja({ titulo, sub = '', html, listo }) {
    $('#hoja-titulo').textContent = titulo;
    const s = $('#hoja-sub');
    s.textContent = sub;
    s.classList.toggle('oculto', !sub);
    $('#hoja-cuerpo').innerHTML = html;
    $('#hoja').scrollTop = 0;
    $('#hoja').classList.add('viva');
    $('#velo').classList.add('viva');
    /* Una entrada de historial por hoja abierta: así el botón «atrás» del
       móvil la cierra en vez de salir de la app, que es lo que hacía y lo
       que rompe la sensación de app instalada. */
    if (!hojaEnHistorial) { history.pushState({ hoja: true }, ''); hojaEnHistorial = true; }
    if (listo) listo($('#hoja-cuerpo'));
  }

  function cerrarHoja(quitarDelHistorial = true) {
    $('#hoja').classList.remove('viva');
    $('#velo').classList.remove('viva');
    $('#hoja').style.transform = '';
    if (hojaEnHistorial) {
      hojaEnHistorial = false;
      if (quitarDelHistorial) history.back();
    }
    if (alCerrarHoja) { const f = alCerrarHoja; alCerrarHoja = null; f(); }
  }

  const alCerrar = (fn) => { alCerrarHoja = fn; };

  function confirmar({ titulo, sub, aceptar = 'Sí, continuar', peligro = false }) {
    return new Promise((resolve) => {
      let decidido = false;
      hoja({
        titulo, sub,
        html: '<div class="botones">'
          + '<button class="btn" data-no>Cancelar</button>'
          + `<button class="btn ${peligro ? 'peligro' : 'principal'}" data-si>${esc(aceptar)}</button>`
          + '</div>',
        listo(c) {
          $('[data-si]', c).onclick = () => { decidido = true; cerrarHoja(); resolve(true); };
          $('[data-no]', c).onclick = () => { decidido = true; cerrarHoja(); resolve(false); };
        },
      });
      alCerrar(() => { if (!decidido) resolve(false); });
    });
  }

  const vibrar = (ms = 8) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };

  /* ---------- compartir texto ----------
     En el móvil abre la hoja del sistema (WhatsApp, notas…); en el
     escritorio copia al portapapeles. */

  async function compartir(texto, titulo) {
    try {
      if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return 'compartido'; }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelado';
    }
    try { await navigator.clipboard.writeText(texto); return 'copiado'; } catch (_) {}
    return 'no';
  }

  /* ---------- cierres globales ---------- */

  $('#velo').addEventListener('click', () => cerrarHoja());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarHoja(); });

  /* El «atrás» del móvil cierra la hoja; el historial ya lo consumió él. */
  window.addEventListener('popstate', () => {
    if ($('#hoja').classList.contains('viva')) cerrarHoja(false);
  });

  /* Arrastrar la hoja hacia abajo la cierra, como en cualquier app. Solo
     cuando está arriba del todo: si no, el dedo desplaza su contenido,
     que es lo que uno espera. El asa también cierra al tocarla. */
  (() => {
    const h = $('#hoja');
    let y0 = null, dy = 0, arrastrable = false;

    h.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || !h.classList.contains('viva')) { y0 = null; return; }
      y0 = e.touches[0].clientY;
      dy = 0;
      arrastrable = h.scrollTop <= 0;
      h.style.transition = 'none';
    }, { passive: true });

    h.addEventListener('touchmove', (e) => {
      if (y0 === null || !arrastrable) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) { h.style.transform = ''; return; }
      e.preventDefault();
      h.style.transform = `translateY(${dy}px)`;
    }, { passive: false });

    const suelta = () => {
      if (y0 === null) return;
      const cerrar = arrastrable && dy > 90;
      h.style.transition = '';
      h.style.transform = '';
      y0 = null; arrastrable = false; dy = 0;
      if (cerrar) cerrarHoja();
    };
    h.addEventListener('touchend', suelta);
    h.addEventListener('touchcancel', suelta);

    $('.asa', h).addEventListener('click', () => cerrarHoja());
  })();

  return { $, $$, esc, tosti, ocultarTosti, hoja, cerrarHoja, alCerrar, confirmar, vibrar, compartir };
})();
