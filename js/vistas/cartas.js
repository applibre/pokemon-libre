/* ===========================================================
   Pokémon Libre · rejilla de cartas
   Todas las cartas de un Pokémon, en orden cronológico y con su
   imagen real. Un toque la marca. Toque largo abre la ficha con
   las variantes: nunca hay que irse a otra página para marcar una
   reverse, que es la queja número uno de las apps que existen.
   =========================================================== */
const Cartas = (() => {
  'use strict';

  const { $, esc, hoja, cerrarHoja, tosti, vibrar } = UI;

  let pokemonId = null;
  let filtros = { texto: '', estado: 'todas' };
  let agrupar = true;

  function iniciar() {
    $('#volver').onclick = () => App.ir('inicio');

    $('#buscar-abrir').onclick = () => {
      const b = $('#buscador');
      b.classList.remove('oculto');
      $('#buscar').focus();
    };
    $('#buscar-cerrar').onclick = () => {
      $('#buscador').classList.add('oculto');
      $('#buscar').value = '';
      filtros.texto = '';
      pintar();
    };

    let espera = null;
    $('#buscar').oninput = (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { filtros.texto = e.target.value; pintar(); }, 120);
    };

    Estado.escuchar(() => { if ($('#p-cartas').classList.contains('viva')) pintar(); });
  }

  function abrir(id) {
    pokemonId = id;
    filtros = { texto: '', estado: 'todas' };
    $('#buscar').value = '';
    $('#buscador').classList.add('oculto');
    App.ir('cartas');
    App.marcarDireccion(id);
    $('#cartas-cuerpo').scrollTop = 0;
  }

  /* ---------- pintar ---------- */

  function pintar() {
    if (!pokemonId) return;
    const poke = Estado.pokemonPorId(pokemonId);
    const todas = Estado.cartasDe(pokemonId);
    const col = Estado.coleccion();
    const p = Dominio.progreso(todas, col);

    $('#cartas-titulo').textContent = poke ? poke.nombre : pokemonId;
    $('#cartas-sub').textContent = `${p.tengo} de ${p.total} · te faltan ${p.faltan}`;

    pintarFiltros(todas, col);

    const lista = Dominio.filtrar(todas, col, filtros);
    const cuerpo = $('#cartas-cuerpo');

    if (!lista.length) {
      cuerpo.innerHTML = `<p class="vacio">${filtros.texto
        ? 'Ninguna carta coincide con esa búsqueda.'
        : (filtros.estado === 'faltan' ? '¡Las tienes todas! 🎉' : 'No hay nada que enseñar aquí.')}</p>`;
      return;
    }

    cuerpo.innerHTML = `<p class="pista chica ayuda">Toca la carta para marcar que la tienes · el botón <b>i</b> abre su ficha</p>`
      + (agrupar
        ? Dominio.porSet(lista, Estado.sets()).map(grupoHTML).join('')
        : `<div class="rejilla">${Dominio.ordenar(lista).map(cartaHTML).join('')}</div>`);

    engancharCartas(cuerpo);
    prepararImagenes(cuerpo);
  }

  function pintarFiltros(todas, col) {
    const n = (estado) => Dominio.filtrar(todas, col, { estado }).length;
    const ops = [
      ['todas', `Todas ${todas.length}`],
      ['faltan', `Me faltan ${n('faltan')}`],
      ['tengo', `Tengo ${n('tengo')}`],
    ];
    $('#filtros').innerHTML = ops.map(([v, t]) =>
      `<button data-f="${v}" class="${filtros.estado === v ? 'viva' : ''}">${esc(t)}</button>`).join('')
      + `<button data-agrupar class="${agrupar ? 'viva' : ''}">Por set</button>`;

    $('#filtros').querySelectorAll('[data-f]').forEach((b) => {
      b.onclick = () => { filtros.estado = b.dataset.f; vibrar(); pintar(); };
    });
    $('[data-agrupar]', $('#filtros')).onclick = () => { agrupar = !agrupar; vibrar(); pintar(); };
  }

  const grupoHTML = (g) => `
    <div class="set-cab">
      <img class="set-logo" src="data/sets/${esc(g.id)}.webp" alt=""
        loading="lazy" onerror="this.remove()">
      <b>${esc(g.set.n)}</b>
      <span>${esc(Dominio.anioDeSet(g.set))} · ${g.cartas.length}</span>
    </div>
    <div class="rejilla">${g.cartas.map(cartaHTML).join('')}</div>`;

  /* Dos acciones por carta, y las dos tienen que verse: tocar la marca,
     el botón «i» abre su ficha. Antes la ficha solo salía con el toque
     largo y nadie lo adivinaba. El botón va fuera del botón de la carta
     porque un botón dentro de otro no es HTML válido. */
  function cartaHTML(c) {
    const col = Estado.coleccion();
    const tengo = Dominio.tengo(col, c.id);
    const n = Dominio.cuantas(col, c.id);
    const sets = Estado.sets();
    const donde = `${esc(c.n)}, ${esc(sets[c.s] ? sets[c.s].n : c.s)}, ${esc(Dominio.numeroCompleto(c, sets))}`;
    return `<div class="celda">
      <button class="carta ${tengo ? 'tengo' : 'falta'}" data-c="${esc(c.id)}"
        aria-label="${donde}${tengo ? ', la tienes' : ', te falta'}"
        aria-pressed="${tengo}">
        <img data-src="data/cartas/${esc(c.id)}.webp" alt="" decoding="async" width="245" height="337">
        <span class="tic">✓</span>
        <span class="nombre-carta" aria-hidden="true">${esc(c.n)}<small>${esc(Dominio.numeroCompleto(c, sets))}</small></span>
        ${n > 1 ? `<span class="cant">×${n}</span>` : ''}
      </button>
      <button class="detalle" data-i="${esc(c.id)}" aria-label="Ver la ficha de ${donde}">i</button>
    </div>`;
  }

  /* ---------- carga diferida de las imágenes ----------
     El loading="lazy" del navegador no llega a pedir las imágenes
     cuando la tarjeta lleva content-visibility: auto — comprobado en
     la app publicada, donde salían todas en blanco. Así que la carga
     se lleva a mano: se piden cuando faltan 500 px para que asomen. */

  let vigia = null;

  /* Con wifi floja una imagen puede fallar. Antes se quedaba en blanco
     para siempre; ahora se reintenta dos veces con pausa y, si aun así
     no llega, se enseña el nombre de la carta para poder marcarla. */
  function cargar(img) {
    const ruta = img.dataset.src;
    delete img.dataset.src;
    let intentos = 0;
    img.onerror = () => {
      intentos++;
      if (intentos <= 2) {
        setTimeout(() => { img.src = `${ruta}${ruta.includes('?') ? '&' : '?'}r=${intentos}`; }, 900 * intentos);
        return;
      }
      img.onerror = null;
      img.removeAttribute('src');
      img.closest('.carta').classList.add('sin-foto');
    };
    img.src = ruta;
  }

  function prepararImagenes(cuerpo) {
    if (vigia) vigia.disconnect();
    vigia = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const img = e.target;
        if (img.dataset.src) { cargar(img); }
        vigia.unobserve(img);
      }
    }, { root: cuerpo, rootMargin: '500px 0px' });

    cuerpo.querySelectorAll('img[data-src]').forEach((i) => vigia.observe(i));
  }

  /* Un toque marca; mantener pulsado abre la ficha. Así se puede
     pasar un fajo entero de cartas sin abrir nada. */
  function engancharCartas(cuerpo) {
    cuerpo.querySelectorAll('[data-i]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); vibrar(); abrirFicha(b.dataset.i); };
    });

    cuerpo.querySelectorAll('.carta').forEach((b) => {
      let temporizador = null;
      let largo = false;

      const empezar = () => {
        largo = false;
        temporizador = setTimeout(() => { largo = true; vibrar(14); abrirFicha(b.dataset.c); }, 420);
      };
      const soltar = () => clearTimeout(temporizador);

      b.addEventListener('pointerdown', empezar);
      b.addEventListener('pointerup', soltar);
      b.addEventListener('pointerleave', soltar);
      b.addEventListener('pointercancel', soltar);
      b.addEventListener('contextmenu', (e) => e.preventDefault());

      b.onclick = () => {
        if (largo) { largo = false; return; }
        const carta = Estado.cartaPorId(b.dataset.c);
        vibrar();
        Estado.alternarCarta(carta);
      };
    });
  }

  /* ---------- la ficha de una carta ---------- */

  function abrirFicha(id) {
    const c = Estado.cartaPorId(id);
    if (!c) return;
    const sets = Estado.sets();
    const set = sets[c.s] || {};
    const enlaces = Dominio.enlaces(c, sets);
    const datos = Dominio.datosDeCarta(c, sets, Estado.cartasDe(c.p[0]));

    hoja({
      titulo: c.n,
      sub: `${set.n || c.s} · ${Dominio.numeroCompleto(c, sets)}${set.rel ? ` · ${Dominio.anioDeSet(set)}` : ''}`,
      html: `
        <img class="ficha-img" src="data/cartas/g/${esc(c.id)}.webp" alt="${esc(c.n)}"
          onerror="this.src='data/cartas/${esc(c.id)}.webp'">

        <div class="variantes" id="variantes"></div>

        <div class="datos">
          ${datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </div>

        ${c.imp && c.imp.length > 1 ? `<div class="impresiones">
          <h3>Cómo se imprimió</h3>
          <ul>${c.imp.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
          <p class="pista chica">Son formas distintas de la misma carta. Las raras suben el precio.</p>
        </div>` : ''}

        ${c.txt ? `<p class="texto-carta">${esc(c.txt)}</p>` : ''}

        <a class="btn ${enlaces.tcgplayer.directo ? 'principal' : ''}" href="${enlaces.tcgplayer.url}"
          target="_blank" rel="noopener">${esc(enlaces.tcgplayer.texto)}</a>
        <a class="btn ${enlaces.tcgcollector.directo && !enlaces.tcgplayer.directo ? 'principal' : ''}" href="${enlaces.tcgcollector.url}"
          target="_blank" rel="noopener" style="margin-top:8px">${esc(enlaces.tcgcollector.texto)}</a>
        <p class="pista chica" style="margin-top:8px">${enlaces.tcgplayer.directo || enlaces.tcgcollector.directo
          ? 'El precio cambia a diario: se mira en la tienda, no aquí.'
          : 'Esta carta no tiene página propia en ninguna de las dos tiendas: los enlaces abren una búsqueda con su nombre, colección y número.'}</p>`,
      listo(cuerpo) { pintarVariantes(cuerpo, c); },
    });
  }

  function pintarVariantes(cuerpo, c) {
    const caja = $('#variantes', cuerpo);
    const dibuja = () => {
      const col = Estado.coleccion();
      caja.innerHTML = c.v.map((v) => {
        const n = Dominio.cuantas(col, c.id, v);
        return `<div class="variante ${n > 0 ? 'tengo' : ''}">
          <button class="menos" data-v="${esc(v)}" data-d="-1" aria-label="Quitar una">−</button>
          <span class="n">${n}</span>
          <button class="mas" data-v="${esc(v)}" data-d="1" aria-label="Añadir una">+</button>
          <span class="nom">${esc(Dominio.nombreVariante(v))}</span>
        </div>`;
      }).join('');

      caja.querySelectorAll('[data-v]').forEach((b) => {
        b.onclick = () => {
          const v = b.dataset.v;
          const actual = Dominio.cuantas(Estado.coleccion(), c.id, v);
          const nueva = Math.max(0, Math.min(99, actual + Number(b.dataset.d)));
          vibrar();
          Estado.ponerVariante(c.id, v, nueva);
          dibuja();
        };
      });
    };
    dibuja();
  }

  return { iniciar, pintar, abrir, abrirFicha };
})();
