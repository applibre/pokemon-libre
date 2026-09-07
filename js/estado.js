/* ===========================================================
   Pokémon Libre · estado
   Un solo sitio donde cambian los datos, más el catálogo cargado
   y sus índices. Quien quiera enterarse, se apunta con escuchar().
   =========================================================== */
const Estado = (() => {
  'use strict';

  let datos = Almacen.leer();
  let catalogo = null;
  let manifiesto = null;
  let indices = null;

  const oyentes = [];
  let pendiente = null;

  const leer = () => datos;
  const cat = () => catalogo;
  const man = () => manifiesto;
  const sets = () => (catalogo ? catalogo.sets : {});

  const escuchar = (fn) => { oyentes.push(fn); return fn; };
  const avisar = () => oyentes.forEach((fn) => { try { fn(datos); } catch (_) {} });

  /* Se guarda con un respiro: marcar diez cartas seguidas escribe
     una vez, no diez. */
  const guardarPronto = () => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => Almacen.guardar(datos), 250);
  };

  function cambiar(fn) { fn(datos); guardarPronto(); avisar(); }

  function guardarYa() { clearTimeout(pendiente); return Almacen.guardar(datos); }

  function reemplazar(nuevos) {
    const base = Almacen.inicial();
    datos = { ...base, ...nuevos, ajustes: { ...base.ajustes, ...(nuevos.ajustes || {}) } };
    guardarYa();
    avisar();
  }

  function reiniciar() { Almacen.borrarTodo(); datos = Almacen.inicial(); avisar(); }

  /* ---------- el catálogo ----------
     Viaja con la app: no se consulta ninguna API al abrir. */

  async function cargarCatalogo() {
    const [c, m] = await Promise.all([
      fetch('data/catalogo.json').then((r) => r.json()),
      fetch('data/manifiesto.json').then((r) => r.json()),
    ]);
    catalogo = c;
    manifiesto = m;
    indices = Dominio.indexar(c);
    if (!datos.creado) cambiar((d) => { d.creado = new Date().toISOString().slice(0, 10); });
    return c;
  }

  /* ---------- atajos ---------- */

  const coleccion = () => datos.coleccion;

  /** Los Pokémon a mostrar, según si quiere ver las preevoluciones. */
  function pokemonVisibles() {
    if (!manifiesto) return [];
    return datos.ajustes.verFamilias
      ? manifiesto.pokemon
      : manifiesto.pokemon.filter((p) => p.principal);
  }

  /** Todas las cartas de los Pokémon visibles, sin repetir. */
  function cartasVisibles() {
    if (!catalogo) return [];
    const ids = new Set(pokemonVisibles().map((p) => p.id));
    return catalogo.cartas.filter((c) => c.p.some((p) => ids.has(p)));
  }

  const cartasDe = (pokemonId) => (indices ? indices.porPokemon.get(pokemonId) || [] : []);
  const cartaPorId = (id) => (indices ? indices.porId.get(id) : null);
  const pokemonPorId = (id) => (manifiesto ? manifiesto.pokemon.find((p) => p.id === id) : null);

  /* ---------- la colección ---------- */

  const alternarCarta = (carta) => cambiar((d) => {
    d.coleccion = Dominio.alternar(d.coleccion, carta);
  });

  const ponerVariante = (id, v, n) => cambiar((d) => {
    d.coleccion = Dominio.conVariante(d.coleccion, id, v, n);
  });

  return {
    leer, cambiar, escuchar, guardarYa, reemplazar, reiniciar,
    cargarCatalogo, cat, man, sets,
    coleccion, pokemonVisibles, cartasVisibles, cartasDe, cartaPorId, pokemonPorId,
    alternarCarta, ponerVariante,
  };
})();
