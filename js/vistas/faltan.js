/* ===========================================================
   Pokémon Libre · lo que me falta
   La lista de la compra. Se lleva a la tienda por WhatsApp o
   copiada: es lo que TCG Collector y Collectr cobran aparte.
   =========================================================== */
const Faltan = (() => {
  'use strict';

  const { $, esc, tosti, compartir } = UI;

  let elegido = null;   // null = todos
  let tope = 0;         // cuántas se están enseñando

  /* Con «Todos» pueden faltar 876 cartas: pintarlas de golpe son más de
     200 KB de HTML y el móvil se arrastra. Se enseñan por tandas. */
  const TANDA = 120;

  function iniciar() {
    Estado.escuchar(() => { if ($('#p-faltan').classList.contains('viva')) pintar(); });
  }

  function pintar() {
    const col = Estado.coleccion();
    const visibles = Estado.pokemonVisibles();
    const cartas = elegido ? Estado.cartasDe(elegido) : Estado.cartasVisibles();
    const faltan = Dominio.filtrar(cartas, col, { estado: 'faltan' });
    const coste = Dominio.costeDeFaltantes(cartas, col);
    const verPrecios = Estado.leer().ajustes.verPrecios;
    const sets = Estado.sets();

    if (!tope) tope = TANDA;
    const mostradas = faltan.slice(0, tope);
    const quedan = faltan.length - mostradas.length;
    const grupos = Dominio.porSet(mostradas, sets);

    $('#faltan-cuerpo').innerHTML = `
      <div class="filtros" style="padding-left:0;padding-right:0">
        <button data-p="" class="${!elegido ? 'viva' : ''}">Todos ${
          Dominio.filtrar(Estado.cartasVisibles(), col, { estado: 'faltan' }).length}</button>
        ${visibles.map((p) => {
          const n = Dominio.filtrar(Estado.cartasDe(p.id), col, { estado: 'faltan' }).length;
          return n ? `<button data-p="${esc(p.id)}" class="${elegido === p.id ? 'viva' : ''}">${esc(p.nombre)} ${n}</button>` : '';
        }).join('')}
      </div>

      ${!faltan.length ? '<p class="vacio">No te falta ninguna. 🎉</p>' : `
        <div class="resumen">
          <div class="gr">${faltan.length} <small>cartas</small></div>
          ${verPrecios && coste.eur ? `<p>Rondarían <b>${esc(Dominio.euros(coste.eur))}</b>
            según Cardmarket · ${coste.conPrecio} de ${coste.cartas} tienen precio conocido</p>`
            : '<p>Lo que te queda para completar</p>'}
        </div>

        <div class="botones" style="margin:12px 0 4px">
          <button class="btn principal" data-compartir>Compartir la lista</button>
        </div>
        <p class="pista chica" style="margin-bottom:16px">Se manda como texto con las
        ${faltan.length} que te faltan: sirve para enseñarla en la tienda o pedirla por WhatsApp.</p>

        ${grupos.map((g) => `
          <div class="set-cab">
            <b>${esc(g.set.n)}</b>
            <span>${esc(Dominio.anioDeSet(g.set))} · ${g.cartas.length}</span>
          </div>
          <div class="tarjeta" style="padding:4px 14px">
            ${g.cartas.map((c) => `
              <button class="fila" data-c="${esc(c.id)}">
                <span>${esc(c.n)}<small>${esc(Dominio.numeroCompleto(c, sets))}${c.r ? ` · ${esc(c.r)}` : ''}</small></span>
                <span class="v">${verPrecios && c.eur ? esc(Dominio.euros(c.eur)) : '›'}</span>
              </button>`).join('')}
          </div>`).join('')}

        ${quedan ? `<button class="btn" data-mas style="margin-top:16px">
          Ver ${Math.min(quedan, TANDA)} más · quedan ${quedan}</button>` : ''}
      `}`;

    const cuerpo = $('#faltan-cuerpo');
    cuerpo.querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = () => { elegido = b.dataset.p || null; tope = TANDA; pintar(); };
    });
    cuerpo.querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => Cartas.abrirFicha(b.dataset.c);
    });
    const bc = $('[data-compartir]', cuerpo);
    if (bc) bc.onclick = () => mandar(cartas, col);
    const bm = $('[data-mas]', cuerpo);
    if (bm) bm.onclick = () => {
      const y = cuerpo.scrollTop;
      tope += TANDA;
      pintar();
      cuerpo.scrollTop = y;   // no saltar al principio al ampliar
    };
  }

  async function mandar(cartas, col) {
    const quien = elegido ? (Estado.pokemonPorId(elegido) || {}).nombre : 'Mi colección';
    const texto = Dominio.listaDeFaltantes(cartas, col, Estado.sets(), quien);
    const r = await compartir(texto, `${quien} · me faltan`);
    if (r === 'copiado') tosti('Lista copiada: ya puedes pegarla', 'buena');
    else if (r === 'compartido') tosti('Lista enviada', 'buena');
    else if (r === 'no') tosti('No se ha podido compartir', 'mala');
  }

  return { iniciar, pintar };
})();
