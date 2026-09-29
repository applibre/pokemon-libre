/* ===========================================================
   Pokémon Libre · las expansiones

   La otra forma de entrar: por colección, de la más antigua a la más
   moderna. Cada una con su logo, su año y cuántas de las tuyas llevas.
   Es el orden en que salieron las cartas al mundo, que es como se
   ordena un álbum.
   =========================================================== */
const Expansiones = (() => {
  'use strict';

  const { $, esc } = UI;

  let filtro = '';

  function iniciar() {
    $('#exp-buscar').oninput = (e) => { filtro = e.target.value; pintar(); };
    Estado.escuchar(() => { if ($('#p-expansiones').classList.contains('viva')) pintar(); });
  }

  /** Las colecciones que tienen alguna carta nuestra, de la más vieja a
      la más nueva, con el progreso de cada una. */
  function lista() {
    const col = Estado.coleccion();
    const sets = Estado.sets();
    const porSet = new Map();
    for (const c of Estado.cartasVisibles()) {
      if (!porSet.has(c.s)) porSet.set(c.s, []);
      porSet.get(c.s).push(c);
    }
    return [...porSet.entries()]
      .map(([id, cartas]) => ({
        id,
        set: sets[id] || { n: id, rel: '', o: 9999 },
        cartas,
        ...Dominio.progreso(cartas, col),
      }))
      .sort((a, b) => (a.set.rel || '9999').localeCompare(b.set.rel || '9999') || a.id.localeCompare(b.id));
  }

  function pintar() {
    const todas = lista();
    const t = Dominio.normaliza(filtro);
    const vistas = t ? todas.filter((g) => Dominio.normaliza(g.set.n).includes(t)) : todas;

    const hechas = todas.filter((g) => g.faltan === 0).length;
    $('#exp-sub').textContent = `${todas.length} colecciones · ${hechas} completas`;

    if (!vistas.length) {
      $('#exp-cuerpo').innerHTML = '<p class="vacio">Ninguna colección se llama así.</p>';
      return;
    }

    let decada = '';
    const trozos = [];
    for (const g of vistas) {
      const anio = Dominio.anioDeSet(g.set);
      const d = anio ? `${anio.slice(0, 3)}0` : '';
      if (!t && d && d !== decada) {
        decada = d;
        trozos.push(`<p class="grupo-titulo">${esc(d)}</p>`);
      }
      trozos.push(filaHTML(g, anio));
    }
    $('#exp-cuerpo').innerHTML = `<div class="expansiones">${trozos.join('')}</div>`;

    $('#exp-cuerpo').querySelectorAll('[data-set]').forEach((b) => {
      b.onclick = () => { UI.vibrar(); Cartas.abrirSet(b.dataset.set); };
    });
  }

  const filaHTML = (g, anio) => `
    <button class="exp ${g.faltan === 0 ? 'completa' : ''}" data-set="${esc(g.id)}">
      <img class="exp-logo" src="data/sets/${esc(g.id)}.webp" alt="" loading="lazy" onerror="this.remove()">
      <span class="exp-nombre">${esc(g.set.n)}</span>
      <span class="exp-anio">${esc(anio)}</span>
      <span class="exp-via"><i style="width:${g.parte * 100}%"></i></span>
      <span class="exp-cuenta">${g.tengo}<small>/${g.total}</small></span>
    </button>`;

  return { iniciar, pintar };
})();
