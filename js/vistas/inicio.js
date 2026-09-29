/* ===========================================================
   Pokémon Libre · pantalla de inicio
   Tus Pokémon con su progreso. Responde de un vistazo y sin tocar
   nada a la pregunta que uno se hace siempre: ¿cuánto me falta?
   =========================================================== */
const Inicio = (() => {
  'use strict';

  const { $, esc } = UI;

  function iniciar() {
    $('#ir-ajustes').onclick = () => App.ir('ajustes');
    Estado.escuchar(() => { if ($('#p-inicio').classList.contains('viva')) pintar(); });
  }

  function pintar() {
    const col = Estado.coleccion();
    const visibles = Estado.pokemonVisibles();
    const todas = Estado.cartasVisibles();
    const total = Dominio.progreso(todas, col);
    const lista = Dominio.progresoPorPokemon(Estado.cat().cartas, col, visibles);

    const principales = lista.filter((p) => p.principal);
    const familias = lista.filter((p) => !p.principal);

    $('#inicio-cuerpo').innerHTML = `
      <div class="resumen">
        <div class="gr">${total.tengo} <small>de ${total.total}</small></div>
        <div class="via"><i style="width:${total.parte * 100}%"></i></div>
        <p>${total.porcentaje}% de tu colección · te faltan <b>${total.faltan}</b> cartas</p>
      </div>

      ${bloque('Mis Pokémon', principales)}
      ${familias.length ? bloque('Sus familias', familias) : ''}

      <p class="pista chica" style="margin-top:22px;text-align:center">
        ${Estado.cat().cartas.length} cartas de ${Object.keys(Estado.sets()).length} colecciones,
        desde 1999. Las imágenes están dentro de la app: funciona sin internet.
      </p>`;

    $('#inicio-cuerpo').querySelectorAll('[data-poke]').forEach((b) => {
      b.onclick = () => Cartas.abrir(b.dataset.poke);
    });
  }

  const bloque = (titulo, lista) => `
    <p class="grupo-titulo">${esc(titulo)}</p>
    <div class="pokes">
      ${lista.map((p) => `
        <button class="poke ${p.faltan === 0 ? 'completo' : ''}" data-poke="${esc(p.id)}"
          style="--tipo: var(--t-${esc(p.tipo)})"
          aria-label="${esc(p.nombre)}: tienes ${p.tengo} de ${p.total}">
          <span class="nom">${esc(p.nombre)}</span>
          <span class="via"><i style="width:${p.parte * 100}%"></i></span>
          <span class="cif"><b>${p.tengo}/${p.total}</b><span>${p.porcentaje}%</span></span>
        </button>`).join('')}
    </div>`;

  return { iniciar, pintar };
})();
