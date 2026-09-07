/* Pruebas del dominio de Pokémon Libre.
   Se ejecutan con:  node --test tests/dominio.test.js
   Usan el catálogo de verdad, no uno inventado: si el catálogo se
   rompe al regenerarlo, estas pruebas se enteran. */

const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dominio.js');
const catalogo = require('../data/catalogo.json');
const manifiesto = require('../data/manifiesto.json');

const { porId, porPokemon } = D.indexar(catalogo);
const CARTAS = catalogo.cartas;
const SETS = catalogo.sets;

/* ================= el catálogo ================= */

test('el catálogo tiene las cartas que debe', () => {
  assert.ok(CARTAS.length > 850, `solo ${CARTAS.length} cartas`);
  assert.strictEqual(CARTAS.length, manifiesto.cartas);
  assert.strictEqual(Object.keys(SETS).length, manifiesto.sets);
});

test('no hay identificadores repetidos', () => {
  assert.strictEqual(new Set(CARTAS.map((c) => c.id)).size, CARTAS.length);
});

test('toda carta tiene lo imprescindible para reconocerla en la mano', () => {
  for (const c of CARTAS) {
    assert.ok(c.id && c.n, `sin id o nombre: ${JSON.stringify(c)}`);
    assert.ok(c.s && SETS[c.s], `${c.id} apunta a un set que no existe: ${c.s}`);
    assert.ok(c.num !== undefined && c.num !== '', `${c.id} sin número`);
    assert.ok(Array.isArray(c.p) && c.p.length, `${c.id} sin Pokémon asignado`);
    assert.ok(Array.isArray(c.v) && c.v.length, `${c.id} sin variantes`);
  }
});

test('toda carta tiene su imagen descargada, en los dos tamaños', () => {
  /* Las imágenes viven en el repositorio: la app no depende de que
     ningún servidor ajeno siga en pie. Se comprueba el fichero de
     verdad, no un campo del catálogo. */
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'data', 'cartas');

  const faltan = [];
  for (const c of CARTAS) {
    for (const sub of ['', 'g']) {
      const f = path.join(dir, sub, `${c.id}.webp`);
      if (!fs.existsSync(f)) faltan.push(path.relative(dir, f));
      else if (fs.statSync(f).size < 800) faltan.push(`${path.relative(dir, f)} (vacío)`);
    }
  }
  assert.strictEqual(faltan.length, 0, `sin fichero: ${faltan.slice(0, 6).join(', ')}`);
});

test('ninguna carta se queda sin su foto real', () => {
  /* Arturo lo dejó claro: una carta que existe pero se ve vacía no
     tiene sentido. bajar-imagenes.py apunta en sin-foto.json las que
     acaban con ficha dibujada; tiene que estar vacío. */
  const sinFoto = require('../scripts/sin-foto.json');
  assert.deepStrictEqual(sinFoto, [], `sin foto: ${sinFoto.join(', ')}`);
});

test('el catálogo no enlaza a ningún servidor', () => {
  const texto = JSON.stringify(catalogo);
  assert.ok(!/https?:\/\//.test(texto), 'el catálogo contiene enlaces externos');
});

test('ninguna carta del juego digital se ha colado', () => {
  const digitales = CARTAS.filter((c) => /^(A\d|P-A)/.test(c.s));
  assert.strictEqual(digitales.length, 0, `${digitales.length} cartas de TCG Pocket`);
});

test('están los doce Pokémon pedidos y las cinco preevoluciones', () => {
  const ids = manifiesto.pokemon.map((p) => p.id);
  for (const p of ['pikachu', 'gengar', 'snorlax', 'charmander', 'charmeleon', 'charizard',
    'bulbasaur', 'ivysaur', 'venusaur', 'squirtle', 'wartortle', 'blastoise',
    'gastly', 'haunter', 'pichu', 'raichu', 'munchlax']) {
    assert.ok(ids.includes(p), `falta ${p}`);
    assert.ok((porPokemon.get(p) || []).length > 0, `${p} sin cartas`);
  }
  assert.strictEqual(manifiesto.pokemon.filter((p) => p.principal).length, 12);
});

test('las cartas emblemáticas están donde deben', () => {
  const charizard = porId.get('base1-4');
  assert.strictEqual(charizard.n, 'Charizard');
  assert.strictEqual(SETS[charizard.s].n, 'Base Set');
  assert.strictEqual(charizard.num, '4');
  assert.ok(charizard.v.includes('holo'));

  const gengar = porId.get('base3-5');
  assert.strictEqual(gengar.n, 'Gengar');
  assert.strictEqual(SETS[gengar.s].n, 'Fossil');

  const pikachu = porId.get('base1-58');
  assert.strictEqual(pikachu.n, 'Pikachu');
});

test('el catálogo abarca de 1999 a hoy', () => {
  const fechas = Object.values(SETS).map((s) => s.rel).filter(Boolean).sort();
  assert.ok(fechas[0].startsWith('1999'), `el más antiguo es ${fechas[0]}`);
  assert.ok(fechas[fechas.length - 1] >= '2026', `el más nuevo es ${fechas.at(-1)}`);
});

test('los sets están ordenados por fecha', () => {
  const ordenados = Object.entries(SETS).sort((a, b) => a[1].o - b[1].o);
  for (let i = 1; i < ordenados.length; i++) {
    const antes = ordenados[i - 1][1].rel || '9999';
    const ahora = ordenados[i][1].rel || '9999';
    assert.ok(antes <= ahora, `${ordenados[i - 1][1].n} (${antes}) va antes que ${ordenados[i][1].n} (${ahora})`);
  }
});

test('las cartas de pareja se cuentan en el Pokémon que toca', () => {
  /* Reunir por número de Pokédex y no por nombre es lo que hace que
     estas entren. Su compañero (Zekrom, Eevee, Reshiram…) no es de
     los nuestros, así que la carta pertenece a uno solo — y eso está
     bien: sale en la lista de Pikachu, que es donde se busca. */
  const parejas = CARTAS.filter((c) => c.n.includes('&'));
  assert.ok(parejas.length > 20, `solo ${parejas.length} cartas de pareja`);

  const zekrom = parejas.find((c) => c.n === 'Pikachu & Zekrom GX');
  assert.ok(zekrom, 'falta «Pikachu & Zekrom GX»');
  assert.deepStrictEqual(zekrom.p, ['pikachu']);

  const reshiram = parejas.find((c) => c.n === 'Reshiram & Charizard GX');
  assert.deepStrictEqual(reshiram.p, ['charizard']);
});

test('todo Pokémon asignado a una carta existe en el manifiesto', () => {
  const conocidos = new Set(manifiesto.pokemon.map((p) => p.id));
  for (const c of CARTAS) {
    for (const p of c.p) assert.ok(conocidos.has(p), `${c.id} apunta a «${p}», que no existe`);
  }
});

test('ninguna carta se cuela sin ser de los nuestros', () => {
  // Entrenadores como «Gengar Spirit Link» llevan el nombre pero no
  // son el Pokémon: se filtran por categoría al generar el catálogo.
  const sospechosas = CARTAS.filter((c) => /Spirit Link|Doll$/i.test(c.n));
  assert.strictEqual(sospechosas.length, 0,
    `se han colado Entrenadores: ${sospechosas.map((c) => c.n).join(', ')}`);
});

/* ================= tener y no tener ================= */

test('una colección vacía no tiene nada', () => {
  assert.strictEqual(D.tengo({}, 'base1-4'), false);
  assert.strictEqual(D.cuantas({}, 'base1-4'), 0);
});

test('marcar una variante hace que tenga la carta', () => {
  const col = D.conVariante({}, 'base1-4', 'holo', 1);
  assert.strictEqual(D.tengo(col, 'base1-4'), true);
  assert.strictEqual(D.tengoVariante(col, 'base1-4', 'holo'), true);
  assert.strictEqual(D.tengoVariante(col, 'base1-4', 'firstEdition'), false);
  assert.strictEqual(D.cuantas(col, 'base1-4'), 1);
});

test('varias variantes de la misma carta se suman', () => {
  let col = D.conVariante({}, 'base1-4', 'holo', 1);
  col = D.conVariante(col, 'base1-4', 'firstEdition', 2);
  assert.strictEqual(D.cuantas(col, 'base1-4'), 3);
  assert.strictEqual(D.cuantas(col, 'base1-4', 'firstEdition'), 2);
});

test('poner una variante a cero la quita, y sin variantes se quita la carta', () => {
  let col = D.conVariante({}, 'base1-4', 'holo', 1);
  col = D.conVariante(col, 'base1-4', 'holo', 0);
  assert.strictEqual(D.tengo(col, 'base1-4'), false);
  assert.ok(!('base1-4' in col), 'no debe quedar basura en la colección');
});

test('cambiar la colección no modifica la anterior', () => {
  const antes = D.conVariante({}, 'base1-4', 'holo', 1);
  const copia = JSON.parse(JSON.stringify(antes));
  D.conVariante(antes, 'base1-4', 'reverse', 1);
  D.alternar(antes, porId.get('base1-4'));
  assert.deepStrictEqual(antes, copia, 'la colección original se ha tocado');
});

test('un toque marca y otro desmarca', () => {
  const carta = porId.get('base3-5');
  const col1 = D.alternar({}, carta);
  assert.strictEqual(D.tengo(col1, carta.id), true);
  const col2 = D.alternar(col1, carta);
  assert.strictEqual(D.tengo(col2, carta.id), false);
});

test('el toque elige la variante más común de la carta', () => {
  assert.strictEqual(D.variantePrincipal({ v: ['normal', 'holo'] }), 'normal');
  assert.strictEqual(D.variantePrincipal({ v: ['holo', 'firstEdition'] }), 'holo');
  assert.strictEqual(D.variantePrincipal({ v: ['wPromo'] }), 'wPromo');
  assert.strictEqual(D.variantePrincipal({ v: [] }), 'normal');
});

/* ================= progreso ================= */

test('el progreso cuenta cartas, no ejemplares', () => {
  const cartas = porPokemon.get('gengar');
  let col = {};
  col = D.conVariante(col, cartas[0].id, 'holo', 3);   // tres copias
  col = D.conVariante(col, cartas[1].id, 'normal', 1);
  const p = D.progreso(cartas, col);
  assert.strictEqual(p.tengo, 2, 'tres copias de una carta siguen siendo una carta');
  assert.strictEqual(p.total, cartas.length);
  assert.strictEqual(p.faltan, cartas.length - 2);
});

test('el progreso vacío y el completo salen bien', () => {
  const cartas = porPokemon.get('munchlax');
  assert.strictEqual(D.progreso(cartas, {}).porcentaje, 0);
  const todas = cartas.reduce((col, c) => D.alternar(col, c), {});
  const p = D.progreso(cartas, todas);
  assert.strictEqual(p.porcentaje, 100);
  assert.strictEqual(p.faltan, 0);
});

test('el progreso por Pokémon devuelve uno por cada uno', () => {
  const lista = D.progresoPorPokemon(CARTAS, {}, manifiesto.pokemon);
  assert.strictEqual(lista.length, manifiesto.pokemon.length);
  for (const p of lista) {
    assert.ok(p.total > 0, `${p.id} sin cartas`);
    assert.strictEqual(p.tengo, 0);
  }
});

/* ================= búsqueda y filtros ================= */

test('la búsqueda ignora acentos, mayúsculas y signos', () => {
  const a = D.filtrar(CARTAS, {}, { texto: 'POKEMON' }).length;
  const b = D.filtrar(CARTAS, {}, { texto: 'pokémon' }).length;
  assert.strictEqual(a, b);
  assert.ok(D.filtrar(CARTAS, {}, { texto: 'gengar ex' }).length > 0);
});

test('se puede buscar por número de carta y por set', () => {
  const porNumero = D.filtrar(porPokemon.get('charizard'), {}, { texto: '4' });
  assert.ok(porNumero.some((c) => c.id === 'base1-4'));

  const porNombreDeSet = D.filtrar(CARTAS, {}, { texto: 'fossil' });
  assert.ok(porNombreDeSet.every((c) => SETS[c.s].n.toLowerCase().includes('fossil')
    || c._b.includes('fossil')));
  assert.ok(porNombreDeSet.some((c) => c.id === 'base3-5'));
});

test('varias palabras se exigen todas', () => {
  const r = D.filtrar(CARTAS, {}, { texto: 'gengar fossil' });
  assert.ok(r.length >= 1);
  assert.ok(r.every((c) => c._b.includes('gengar') && c._b.includes('fossil')));
});

test('una búsqueda sin resultados devuelve lista vacía, no todo', () => {
  assert.strictEqual(D.filtrar(CARTAS, {}, { texto: 'zzzznoexiste' }).length, 0);
});

test('el filtro de tengo / me faltan reparte todas las cartas', () => {
  const cartas = porPokemon.get('snorlax');
  const col = D.alternar({}, cartas[0]);
  const tengo = D.filtrar(cartas, col, { estado: 'tengo' });
  const faltan = D.filtrar(cartas, col, { estado: 'faltan' });
  assert.strictEqual(tengo.length, 1);
  assert.strictEqual(tengo.length + faltan.length, cartas.length);
});

test('los filtros se combinan', () => {
  const r = D.filtrar(CARTAS, {}, { texto: 'pikachu', set: 'base1' });
  assert.ok(r.length > 0);
  assert.ok(r.every((c) => c.s === 'base1' && c._b.includes('pikachu')));
});

/* ================= orden ================= */

test('el orden por defecto es cronológico y, dentro del set, por número', () => {
  const r = D.ordenar(porPokemon.get('charizard'));
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    assert.ok(a._o < b._o || (a._o === b._o
      && String(a.num).localeCompare(String(b.num), 'en', { numeric: true }) <= 0),
    `${a.id} no debería ir antes que ${b.id}`);
  }
  assert.strictEqual(r[0].s, 'base1', 'el primer Charizard debe ser el del Base Set');
});

test('el número se ordena como número, no como texto', () => {
  const set = D.filtrar(CARTAS, {}, { set: 'base1' });
  const nums = D.ordenar(set).map((c) => parseInt(c.num, 10)).filter((n) => !isNaN(n));
  for (let i = 1; i < nums.length; i++) {
    assert.ok(nums[i - 1] <= nums[i], `${nums[i - 1]} va antes que ${nums[i]}`);
  }
});

test('ordenar por precio pone las caras primero', () => {
  const r = D.ordenar(CARTAS.filter((c) => c.eur), 'precio');
  assert.ok(r[0].eur >= r[r.length - 1].eur);
  assert.ok(r[0].eur > 100, `la más cara sale a ${r[0].eur} €`);
});

test('agrupar por set respeta el orden cronológico', () => {
  const grupos = D.porSet(porPokemon.get('gengar'), SETS);
  assert.ok(grupos.length > 5);
  for (let i = 1; i < grupos.length; i++) {
    assert.ok(grupos[i - 1].set.o < grupos[i].set.o);
  }
  assert.ok(grupos[0].cartas.length > 0);
});

/* ================= lista de compra ================= */

test('la lista de faltantes trae solo las que faltan', () => {
  const cartas = porPokemon.get('munchlax');
  const col = D.alternar({}, cartas[0]);
  const texto = D.listaDeFaltantes(cartas, col, SETS, 'Munchlax');

  assert.ok(texto.includes(`me faltan ${cartas.length - 1} de ${cartas.length}`));
  assert.ok(!texto.includes(`   ${cartas[0].num} `), 'ha listado una que sí tengo');
  for (const c of cartas.slice(1)) assert.ok(texto.includes(c.n));
});

test('la lista agrupa por set y se puede leer tal cual', () => {
  const texto = D.listaDeFaltantes(porPokemon.get('gengar'), {}, SETS, 'Gengar');
  assert.ok(texto.includes('— Fossil (1999)'));
  assert.ok(texto.split('\n').length > 10);
  assert.ok(texto.endsWith('applibre.github.io/pokemon-libre'));
});

test('el coste de lo que falta suma solo lo que tiene precio', () => {
  const cartas = porPokemon.get('gengar');
  const c = D.costeDeFaltantes(cartas, {});
  assert.strictEqual(c.cartas, cartas.length);
  assert.ok(c.conPrecio <= c.cartas);
  assert.ok(c.eur > 0);
});

/* ================= enlaces y formato ================= */

test('con identificador, el enlace de TCGplayer abre la página de esa carta', () => {
  const e = D.enlaces(porId.get('base3-5'), SETS);   // Gengar de Fossil: id 106521
  assert.strictEqual(e.tcgplayer.url, 'https://www.tcgplayer.com/product/106521');
  assert.strictEqual(e.tcgplayer.directo, true);
});

test('sin identificador, el enlace es una búsqueda y se dice', () => {
  const sinId = CARTAS.find((c) => !c.tp_id);
  const e = D.enlaces(sinId, SETS);
  assert.ok(e.tcgplayer.url.includes('/search/'));
  assert.strictEqual(e.tcgplayer.directo, false);
  assert.ok(e.tcgplayer.texto.startsWith('Buscar'));
  assert.ok(!/[ ]/.test(e.tcgplayer.url), 'la URL lleva espacios sin codificar');
});

test('con identificador, el enlace de TCG Collector abre la página de esa carta', () => {
  const con = CARTAS.find((c) => c.tc_id);
  if (!con) return;   // aún no localizadas
  const e = D.enlaces(con, SETS);
  assert.strictEqual(e.tcgcollector.url, `https://www.tcgcollector.com/cards/${con.tc_id}/${con.tc_slug}`);
  assert.strictEqual(e.tcgcollector.directo, true);
});

/* Una dirección de TCG Collector siempre empieza por el nombre de la
   carta. Si no empieza por él es que apunta a otra carta, y eso es peor
   que no tener enlace: mandaría a comprar la que no es. */
test('todas las direcciones de TCG Collector empiezan por el nombre de su carta', () => {
  // como escribe TCG Collector: «Sabrina's Gengar» → sabrinas-gengar
  const flojo = (t) => D.normaliza(String(t)
    .replace(/&/g, ' and ').replace(/[☆★]/g, ' star ').replace(/['_]/g, '')).replace(/ /g, '-');
  for (const c of CARTAS) {
    if (!c.tc_id) continue;
    assert.ok(Number.isInteger(c.tc_id) && c.tc_id > 0, `${c.id}: id raro ${c.tc_id}`);
    assert.ok(typeof c.tc_slug === 'string' && c.tc_slug.length > 3, `${c.id}: dirección vacía`);
    assert.ok(c.tc_slug.startsWith(flojo(c.n) + '-'), `${c.id}: «${c.tc_slug}» no empieza por «${c.n}»`);
  }
});

test('la mayoría de las cartas tiene enlace directo a TCG Collector', () => {
  const directos = CARTAS.filter((c) => c.tc_id).length;
  assert.ok(directos / CARTAS.length > 0.9, `solo ${directos} de ${CARTAS.length}`);
});

test('ninguna carta enlaza a Cardmarket', () => {
  const e = D.enlaces(porId.get('base3-5'), SETS);
  assert.ok(!JSON.stringify(e).includes('cardmarket.com'));
});

test('la mayoría de las cartas tiene enlace directo a TCGplayer', () => {
  const directos = CARTAS.filter((c) => c.tp_id).length;
  assert.ok(directos / CARTAS.length > 0.8, `solo ${directos} de ${CARTAS.length}`);
  for (const c of CARTAS) if (c.tp_id) assert.ok(Number.isInteger(c.tp_id) && c.tp_id > 0, `${c.id}: id raro ${c.tp_id}`);
});

test('el número se enseña como en la carta', () => {
  assert.strictEqual(D.numeroCompleto(porId.get('base1-4'), SETS), '4/102');
});

test('los precios se escriben a la española y a la americana', () => {
  assert.strictEqual(D.euros(466.22), '466,22 €');
  assert.strictEqual(D.dolares(897.19), '$897.19');
  assert.strictEqual(D.euros(null), '');
});

test('las variantes tienen nombre en castellano', () => {
  assert.strictEqual(D.nombreVariante('reverse'), 'Reverse holo');
  assert.strictEqual(D.nombreVariante('firstEdition'), '1.ª edición');
  // ninguna variante del catálogo se queda sin nombre
  const usadas = new Set(CARTAS.flatMap((c) => c.v));
  for (const v of usadas) {
    assert.ok(D.NOMBRE_VARIANTE[v], `la variante «${v}» no tiene nombre`);
  }
});
