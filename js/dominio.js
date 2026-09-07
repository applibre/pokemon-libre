/* ===========================================================
   Pokémon Libre · dominio
   Funciones puras sobre el catálogo y la colección: progreso,
   filtros, búsqueda y lista de faltantes.

   Aquí no se toca el DOM ni el almacenamiento: todo entra por
   parámetro y todo sale devuelto. Por eso se prueba con Node.

   Dos palabras que conviene no mezclar:
     · carta     — la que existe en el mundo (Gengar de Fossil, 5/62)
     · ejemplar  — una impresión concreta que tienes tú (la holo)
   Una carta puede tener varias variantes; el progreso cuenta cartas,
   no ejemplares, porque «me falta Gengar de Fossil» es lo que se
   pregunta uno en la tienda.
   =========================================================== */
const Dominio = (() => {
  'use strict';

  /* ---------- texto ----------
     Para buscar, todo a minúsculas y sin acentos ni signos: así
     «Pokemon», «Pokémon» y «pokemon» son lo mismo, y «Gengar-EX»
     se encuentra escribiendo «gengar ex». */

  const normaliza = (t) => String(t == null ? '' : t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  /* ---------- variantes ---------- */

  const NOMBRE_VARIANTE = {
    normal: 'Normal',
    holo: 'Holo',
    reverse: 'Reverse holo',
    firstEdition: '1.ª edición',
    wPromo: 'Promo',
  };
  const ABREV_VARIANTE = {
    normal: 'Norm', holo: 'Holo', reverse: 'Rev', firstEdition: '1.ª', wPromo: 'Promo',
  };

  const nombreVariante = (v) => NOMBRE_VARIANTE[v] || v;
  const abrevVariante = (v) => ABREV_VARIANTE[v] || v;

  /* ---------- la colección ----------
     Forma: { 'base1-4': { holo: 1, firstEdition: 2 } }
     Solo se guarda lo que se tiene; ausencia = no la tengo. */

  /** ¿Tengo esta carta, en la variante que sea? */
  const tengo = (coleccion, id) => {
    const c = coleccion[id];
    if (!c) return false;
    return Object.values(c).some((n) => n > 0);
  };

  const tengoVariante = (coleccion, id, v) => ((coleccion[id] || {})[v] || 0) > 0;

  const cuantas = (coleccion, id, v) => {
    const c = coleccion[id];
    if (!c) return 0;
    if (v) return c[v] || 0;
    return Object.values(c).reduce((a, n) => a + n, 0);
  };

  /** Devuelve una colección nueva; no muta la que recibe. */
  function conVariante(coleccion, id, v, cantidad) {
    const salida = { ...coleccion };
    const carta = { ...(salida[id] || {}) };
    if (cantidad > 0) carta[v] = cantidad;
    else delete carta[v];

    if (Object.keys(carta).length) salida[id] = carta;
    else delete salida[id];
    return salida;
  }

  /** Un toque sobre la carta: si no la tengo, la marco en su variante
      principal; si ya la tengo de cualquier forma, la desmarco entera. */
  function alternar(coleccion, carta) {
    if (tengo(coleccion, carta.id)) {
      const salida = { ...coleccion };
      delete salida[carta.id];
      return salida;
    }
    return conVariante(coleccion, carta.id, variantePrincipal(carta), 1);
  }

  /** La variante que se asume al marcar de un toque: la más común de
      las que tiene la carta, en este orden. */
  function variantePrincipal(carta) {
    const v = carta.v || [];
    for (const preferida of ['normal', 'holo', 'reverse', 'wPromo', 'firstEdition']) {
      if (v.includes(preferida)) return preferida;
    }
    return v[0] || 'normal';
  }

  /* ---------- progreso ---------- */

  function progreso(cartas, coleccion) {
    let tengoN = 0;
    for (const c of cartas) if (tengo(coleccion, c.id)) tengoN++;
    return {
      total: cartas.length,
      tengo: tengoN,
      faltan: cartas.length - tengoN,
      parte: cartas.length ? tengoN / cartas.length : 0,
      porcentaje: cartas.length ? Math.round((tengoN / cartas.length) * 100) : 0,
    };
  }

  /** Progreso de cada Pokémon del manifiesto. */
  function progresoPorPokemon(cartas, coleccion, pokemon) {
    return pokemon.map((p) => {
      const suyas = cartas.filter((c) => c.p.includes(p.id));
      return { ...p, ...progreso(suyas, coleccion) };
    });
  }

  /* ---------- índices ----------
     Se construyen una vez al cargar; después todo es instantáneo. */

  function indexar(catalogo) {
    const porId = new Map();
    const porPokemon = new Map();

    for (const c of catalogo.cartas) {
      porId.set(c.id, c);
      for (const p of c.p) {
        if (!porPokemon.has(p)) porPokemon.set(p, []);
        porPokemon.get(p).push(c);
      }
      // texto de búsqueda precalculado: nombre + set + número
      const set = catalogo.sets[c.s];
      c._b = normaliza(`${c.n} ${set ? set.n : ''} ${c.s} ${c.num} ${c.r} ${c.ill}`);
      c._o = set ? set.o : 9999;
    }
    return { porId, porPokemon };
  }

  /* ---------- búsqueda y filtros ----------
     Un filtro lineal sobre 876 cartas tarda menos de un milisegundo:
     no hace falta ninguna librería de búsqueda. */

  function filtrar(cartas, coleccion, filtros = {}) {
    const { texto = '', estado = 'todas', set = null, rareza = null, variante = null } = filtros;
    const termino = normaliza(texto);
    const palabras = termino ? termino.split(' ') : [];

    return cartas.filter((c) => {
      if (estado === 'tengo' && !tengo(coleccion, c.id)) return false;
      if (estado === 'faltan' && tengo(coleccion, c.id)) return false;
      if (set && c.s !== set) return false;
      if (rareza && c.r !== rareza) return false;
      if (variante && !(c.v || []).includes(variante)) return false;
      for (const p of palabras) if (!c._b.includes(p)) return false;
      return true;
    });
  }

  /** Orden: por fecha del set y, dentro del set, por número. */
  const porOrden = (a, b) =>
    a._o - b._o || String(a.num).localeCompare(String(b.num), 'en', { numeric: true });

  function ordenar(cartas, modo = 'set') {
    const copia = [...cartas];
    if (modo === 'nombre') {
      return copia.sort((a, b) => a.n.localeCompare(b.n, 'es') || porOrden(a, b));
    }
    if (modo === 'precio') {
      return copia.sort((a, b) => (b.eur || 0) - (a.eur || 0) || porOrden(a, b));
    }
    if (modo === 'reciente') return copia.sort((a, b) => -porOrden(a, b));
    return copia.sort(porOrden);
  }

  /** Las cartas agrupadas por set, en orden cronológico. */
  function porSet(cartas, sets) {
    const grupos = new Map();
    for (const c of ordenar(cartas)) {
      if (!grupos.has(c.s)) grupos.set(c.s, []);
      grupos.get(c.s).push(c);
    }
    return [...grupos.entries()].map(([id, lista]) => ({
      id,
      set: sets[id] || { n: id, rel: '', o: 9999 },
      cartas: lista,
    }));
  }

  /* ---------- lista de compra ---------- */

  /** Texto llano de las que faltan, para mandar por WhatsApp o
      llevarlo apuntado a la tienda. */
  function listaDeFaltantes(cartas, coleccion, sets, titulo) {
    const faltan = ordenar(cartas.filter((c) => !tengo(coleccion, c.id)));
    const lineas = [`${titulo} · me faltan ${faltan.length} de ${cartas.length}`, ''];

    let setActual = null;
    for (const c of faltan) {
      if (c.s !== setActual) {
        setActual = c.s;
        const s = sets[c.s];
        lineas.push(`— ${s ? s.n : c.s}${s && s.rel ? ` (${s.rel.slice(0, 4)})` : ''}`);
      }
      const precio = c.eur ? `  ·  ${c.eur} €` : '';
      lineas.push(`   ${c.num}${c.r ? ` ${c.r}` : ''}  ${c.n}${precio}`);
    }
    lineas.push('', 'Pokémon Libre · applibre.github.io/pokemon-libre');
    return lineas.join('\n');
  }

  /** Lo que costaría completar, con lo que se sabe de precios. */
  function costeDeFaltantes(cartas, coleccion) {
    const faltan = cartas.filter((c) => !tengo(coleccion, c.id));
    const conPrecio = faltan.filter((c) => c.eur);
    return {
      cartas: faltan.length,
      conPrecio: conPrecio.length,
      eur: Math.round(conPrecio.reduce((a, c) => a + c.eur, 0) * 100) / 100,
    };
  }

  /* ---------- enlaces a las tiendas ----------
     Con identificador de producto, el enlace abre la página de ESA
     carta, con su precio en tiempo real. Sin él, no queda otra que un
     buscador con el nombre, la colección y el número — y se dice. */

  const enlaces = (carta, sets) => {
    const set = sets[carta.s];
    const busca = `${carta.n} ${set ? set.n : ''} ${carta.num}`.trim();
    const q = encodeURIComponent(busca);
    return {
      tcgplayer: carta.tp_id
        ? { url: `https://www.tcgplayer.com/product/${carta.tp_id}`, directo: true, texto: 'Ver precio en TCGplayer' }
        : { url: `https://www.tcgplayer.com/search/pokemon/product?q=${q}`, directo: false, texto: 'Buscar en TCGplayer' },
      cardmarket: carta.cm_id
        ? { url: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q}`, directo: false, texto: 'Buscar en Cardmarket', id: carta.cm_id }
        : { url: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q}`, directo: false, texto: 'Buscar en Cardmarket' },
    };
  };

  /* ---------- formato ---------- */

  const anioDeSet = (set) => (set && set.rel ? set.rel.slice(0, 4) : '');
  const numeroCompleto = (carta, sets) => {
    const s = sets[carta.s];
    return s && s.tot ? `${carta.num}/${s.tot}` : String(carta.num);
  };
  const euros = (n) => (n == null ? '' : `${n.toFixed(2).replace('.', ',')} €`);
  const dolares = (n) => (n == null ? '' : `$${n.toFixed(2)}`);

  return {
    normaliza,
    nombreVariante, abrevVariante, variantePrincipal, NOMBRE_VARIANTE,
    tengo, tengoVariante, cuantas, conVariante, alternar,
    progreso, progresoPorPokemon,
    indexar, filtrar, ordenar, porSet,
    listaDeFaltantes, costeDeFaltantes, enlaces,
    anioDeSet, numeroCompleto, euros, dolares,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Dominio;
