/* ===========================================================
   Pokémon Libre · generador del catálogo
   Baja de TCGdex todas las cartas de los Pokémon objetivo y deja
   en data/ un catálogo compacto que viaja DENTRO de la app.

   Por qué no se consulta ninguna API al abrir la app: la que era
   la API «oficial» (pokemontcg.io) cerró y pasó a un servicio de
   pago; devolvía errores 502 al probarla. Una colección no puede
   depender de que un servicio ajeno siga vivo.

   Uso:
     node scripts/catalogo.mjs            genera el catálogo
     node scripts/catalogo.mjs --refresca  ignora la caché local
     node scripts/catalogo.mjs --imagenes  además comprueba imagen a imagen

   No tiene dependencias: solo Node.
   =========================================================== */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const CACHE = path.join(AQUI, '.cache');
const DATOS = path.join(RAIZ, 'data');

const API = 'https://api.tcgdex.net/v2/en';
const ASSETS = 'https://assets.tcgdex.net';
const RESPALDO = 'https://images.pokemontcg.io';

const refresca = process.argv.includes('--refresca');
const compruebaImagenes = process.argv.includes('--imagenes');

/* ---------- utilidades de red ----------
   Con calma: TCGdex es un proyecto comunitario y llegó a bloquear
   IPs por exceso de peticiones. Concurrencia baja y reintentos. */

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'CartaLibre/1.0 (applibre; coleccion personal)' },
        signal: AbortSignal.timeout(30000),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === intentos) throw new Error(`${url} → ${e.message}`);
      await dormir(600 * i);
    }
  }
}

/** Ejecuta tareas de pocas en pocas, para no atropellar al servidor. */
async function enTandas(cosas, tamano, fn, alAvanzar) {
  const salida = [];
  for (let i = 0; i < cosas.length; i += tamano) {
    const tanda = cosas.slice(i, i + tamano);
    salida.push(...await Promise.all(tanda.map(fn)));
    if (alAvanzar) alAvanzar(Math.min(i + tamano, cosas.length), cosas.length);
    await dormir(150);
  }
  return salida;
}

/* ---------- caché en disco ----------
   Una ficha por fichero. La segunda vez el script tarda segundos
   en vez de minutos, y se puede trabajar sin conexión. */

async function conCache(clave, fn) {
  const f = path.join(CACHE, `${clave.replace(/[^\w.-]/g, '_')}.json`);
  if (!refresca && existsSync(f)) {
    try { return JSON.parse(await readFile(f, 'utf8')); } catch (_) {}
  }
  const v = await fn();
  if (v !== null && v !== undefined) await writeFile(f, JSON.stringify(v));
  return v;
}

/* ---------- variantes ----------
   Rareza es del catálogo; variante es de la impresión física que
   tienes en la mano. Son cosas distintas y van en campos distintos:
   confundirlas es el error que han tenido que deshacer varios
   proyectos parecidos. */

const NOMBRE_VARIANTE = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse holo',
  firstEdition: '1.ª edición',
  wPromo: 'Promo',
};

function variantesDe(carta) {
  const v = carta.variants || {};
  const claves = ['normal', 'holo', 'reverse', 'firstEdition', 'wPromo']
    .filter((k) => v[k]);

  // Algunas promos y sets recién añadidos vienen sin datos de variante.
  // Se asume la única impresión posible en vez de dejar la carta muda.
  if (!claves.length) return [carta.rarity === 'Promo' ? 'wPromo' : 'normal'];
  return claves;
}

/* ---------- imágenes ----------
   Cada carta debe enseñarse de verdad. TCGdex sirve la mayoría;
   para las que no tiene (promos, McDonald's, kits) se prueba el
   CDN de pokemontcg.io, que sigue en pie aunque su API muriera.
   Lo que no aparezca por ninguna vía se marca, no se esconde. */

const RESPALDO_SET = {
  // TCGdex y pokemontcg.io no siempre nombran igual el set
  smp: 'smp', swshp: 'swshp', svp: 'svp', xyp: 'xyp', bwp: 'bwp',
  dpp: 'dpp', np: 'np', ecard1: 'ecard1',
};

function urlTcgdex(carta, calidad = 'low', ext = 'webp') {
  if (!carta.image) return null;
  return `${carta.image}/${calidad}.${ext}`;
}

function urlRespaldo(carta) {
  const set = carta.set?.id;
  if (!set) return null;
  const s = RESPALDO_SET[set] || set;
  return `${RESPALDO}/${s}/${carta.localId}.png`;
}

async function existe(url) {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    return r.ok;
  } catch (_) { return false; }
}

/* ---------- generación ---------- */

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(DATOS, { recursive: true });

  const objetivos = JSON.parse(await readFile(path.join(AQUI, 'objetivos.json'), 'utf8'));
  const tcgcollector = JSON.parse(await readFile(path.join(AQUI, 'tcgcollector.json'), 'utf8').catch(() => '{}'));
  const tcgplayerExtra = JSON.parse(await readFile(path.join(AQUI, 'tcgplayer.json'), 'utf8').catch(() => '{}'));
  /* Las que ningún buscador da con nombre y número: localizadas a mano,
     comprobadas abriendo su página, y con la última palabra sobre las
     automáticas. */
  const aMano = async (f) => Object.fromEntries(Object.entries(
    JSON.parse(await readFile(path.join(AQUI, f), 'utf8').catch(() => '{}')))
    .filter(([k]) => !k.startsWith('_')));
  Object.assign(tcgcollector, await aMano('tcgcollector-manual.json'));
  Object.assign(tcgplayerExtra, await aMano('tcgplayer-manual.json'));
  const pokemon = [
    ...objetivos.principales.map((p) => ({ ...p, principal: true })),
    ...objetivos.familias.map((p) => ({ ...p, principal: false })),
  ];

  console.log(`Pokémon objetivo: ${pokemon.length} (${objetivos.principales.length} principales)\n`);

  /* 1 · qué cartas hay de cada uno, por número de Pokédex */
  const porCarta = new Map();   // id → [dex]
  for (const p of pokemon) {
    const lista = await conCache(`dex-${p.dex}`, () => pedir(`${API}/cards?dexId=eq:${p.dex}`)) || [];
    let contadas = 0;
    for (const c of lista) {
      const set = c.id.slice(0, c.id.lastIndexOf('-'));
      if (/^(A\d|P-A)/.test(set)) continue;          // TCG Pocket: cartas digitales
      if (!porCarta.has(c.id)) porCarta.set(c.id, []);
      porCarta.get(c.id).push(p.dex);
      contadas++;
    }
    console.log(`  ${p.nombre.padEnd(12)} ${String(contadas).padStart(4)} cartas`);
  }
  const ids = [...porCarta.keys()].sort();
  console.log(`\nCartas únicas: ${ids.length}\n`);

  /* 2 · la ficha completa de cada carta */
  process.stdout.write('Fichas: ');
  const fichas = (await enTandas(ids, 5,
    (id) => conCache(`carta-${id}`, () => pedir(`${API}/cards/${id}`)),
    (n, t) => process.stdout.write(`\rFichas: ${n}/${t}`),
  )).filter(Boolean);
  console.log('\n');

  const cartasPokemon = fichas.filter((c) => c.category === 'Pokemon');
  const descartadas = fichas.length - cartasPokemon.length;
  if (descartadas) console.log(`Descartados ${descartadas} Entrenadores/Energías con nombre de Pokémon\n`);

  /* 3 · los sets, con su fecha (la lista breve no la trae) */
  const setsIds = [...new Set(cartasPokemon.map((c) => c.set.id))].sort();
  process.stdout.write('Sets: ');
  const setsFichas = (await enTandas(setsIds, 5,
    (id) => conCache(`set-${id}`, () => pedir(`${API}/sets/${id}`)),
    (n, t) => process.stdout.write(`\rSets: ${n}/${t}`),
  )).filter(Boolean);
  console.log('\n');

  /* Fuera las cartas de Pokémon TCG Pocket: son del juego de móvil, no
     existen en cartón y no se pueden comprar ni coleccionar. Se mira la
     serie de cada set y no su identificador, porque los nuevos (B1, B1a,
     B2…) ya no empiezan por A y se colaban en el catálogo. */
  const digitales = new Set(setsFichas.filter((s) => s.serie?.id === 'tcgp').map((s) => s.id));
  const soloPokemon = cartasPokemon.filter((c) => !digitales.has(c.set.id));
  if (digitales.size) {
    console.log(`Fuera ${cartasPokemon.length - soloPokemon.length} cartas de Pokémon TCG Pocket`
      + ` (${[...digitales].join(', ')}): son digitales\n`);
  }

  const sets = {};
  for (const s of setsFichas.filter((s) => !digitales.has(s.id))) {
    sets[s.id] = {
      n: s.name,
      rel: s.releaseDate || '',
      tot: s.cardCount?.official || s.cardCount?.total || 0,
      logo: s.logo || null,
      sim: s.symbol || null,
    };
  }
  const orden = Object.keys(sets).sort((a, b) =>
    (sets[a].rel || '9999').localeCompare(sets[b].rel || '9999') || a.localeCompare(b));
  orden.forEach((id, i) => { sets[id].o = i; });

  /* 4 · comprobar las imágenes, una a una */
  let sinImagen = 0, conRespaldo = 0;
  if (compruebaImagenes) {
    const dudosas = soloPokemon.filter((c) => !c.image);
    process.stdout.write(`Imágenes de respaldo: `);
    const res = await enTandas(dudosas, 6,
      async (c) => ({ id: c.id, url: await existe(urlRespaldo(c)) ? urlRespaldo(c) : null }),
      (n, t) => process.stdout.write(`\rImágenes de respaldo: ${n}/${t}`),
    );
    const mapa = new Map(res.map((r) => [r.id, r.url]));
    for (const c of soloPokemon) if (!c.image) c._respaldo = mapa.get(c.id) || null;
    conRespaldo = res.filter((r) => r.url).length;
    sinImagen = dudosas.length - conRespaldo;
    console.log('\n');
  } else {
    sinImagen = soloPokemon.filter((c) => !c.image).length;
  }

  /* 5 · el catálogo compacto */
  const cartas = soloPokemon.map((c) => {
    const dexes = porCarta.get(c.id) || [];
    const suyos = pokemon.filter((p) => dexes.includes(p.dex)).map((p) => p.id);
    const ficha = {
      id: c.id,
      n: c.name,
      p: suyos,                                  // a qué Pokémon pertenece
      s: c.set.id,
      num: c.localId,
      r: c.rarity || '',
      v: variantesDe(c),
      img: c.image ? c.image.replace(`${ASSETS}/`, '') : null,
      ill: c.illustrator || '',
    };

    /* Lo que se enseña en la ficha y no caduca: etapa, de quién
       evoluciona, puntos de salud y tipo. Ni impresiones ni texto de la
       carta: Arturo los quitó, no le servían. */
    const ficha_juego = {};
    if (c.stage) ficha_juego.e = c.stage;
    if (c.evolveFrom) ficha_juego.de = c.evolveFrom;
    if (c.hp) ficha_juego.ps = c.hp;
    if (c.types?.length) ficha_juego.t = c.types;
    if (Object.keys(ficha_juego).length) ficha.j = ficha_juego;

    /* Precio orientativo de las dos casas: Cardmarket en euros (la
       referencia en Europa) y TCGplayer en dólares (el mercado grande).
       El manifiesto guarda la fecha: un precio sin fecha engaña. */
    const cm = c.pricing?.cardmarket;
    const eur = cm?.trend ?? cm?.avg ?? cm?.avg7 ?? null;
    if (eur) ficha.eur = Math.round(eur * 100) / 100;

    const tp = c.pricing?.tcgplayer;
    if (tp) {
      const precios = Object.values(tp)
        .filter((v) => v && typeof v === 'object' && v.marketPrice)
        .map((v) => v.marketPrice);
      if (precios.length) ficha.usd = Math.round(Math.min(...precios) * 100) / 100;
    }

    /* Identificadores de producto en cada tienda: con ellos el enlace
       abre la página de ESA carta, con su precio en tiempo real, en vez
       de un buscador genérico. */
    if (cm?.idProduct) ficha.cm_id = cm.idProduct;
    const tpIds = Object.values(tp || {})
      .filter((v) => v && typeof v === 'object' && v.productId)
      .map((v) => v.productId);
    if (tpIds.length) ficha.tp_id = Math.min(...tpIds);
    // y si TCGdex no lo trae (promos, kits, novedades), el que localizó
    // scripts/tcgplayer.py en el buscador de la propia tienda
    else if (tcgplayerExtra[c.id]) ficha.tp_id = tcgplayerExtra[c.id].tp;
    // TCG Collector: localizado una vez por scripts/tcgcollector.py
    if (tcgcollector[c.id]) { ficha.tc_id = tcgcollector[c.id].tc; ficha.tc_slug = tcgcollector[c.id].slug; }
    return ficha;
  }).sort((a, b) =>
    (sets[a.s]?.o ?? 9999) - (sets[b.s]?.o ?? 9999)
    || String(a.num).localeCompare(String(b.num), 'en', { numeric: true }));

  /* 5.4 · las que TCGdex no tiene
     Le faltan productos ingleses enteros: el TCG Classic de 2023, los box
     topper, la World Collection. Se leen de pkmncards con
     scripts/cartas-extra.py y entran aquí con la misma forma que las
     demás; sus imágenes van en imagenes-rescatadas.json. */
  const extra = JSON.parse(await readFile(path.join(AQUI, 'cartas-extra.json'), 'utf8').catch(() => '[]'));
  let anadidas = 0;
  for (const e of extra) {
    if (cartas.some((c) => c.id === e.id)) continue;
    const suyos = pokemon.filter((p) => p.nombre.toLowerCase() === String(e.n).toLowerCase()).map((p) => p.id);
    if (!suyos.length) { console.log(`  ! ${e.id}: ${e.n} no es de los nuestros`); continue; }
    if (e.set_n && !sets[e.set]) {
      sets[e.set] = { n: e.set_n, rel: e.rel || '', tot: e.tot || 0 };
    }
    const ficha = {
      id: e.id, n: e.n, p: suyos, s: e.set, num: e.num,
      r: e.r || '', v: ['normal'], img: null, ill: e.ill || '',
    };
    const j = {};
    if (e.etapa) j.e = e.etapa;
    if (e.de) j.de = e.de;
    if (e.ps) j.ps = e.ps;
    if (Object.keys(j).length) ficha.j = j;
    // los enlaces a las tiendas se asignan aquí también: estas cartas
    // entran después del reparto general y si no se quedarían sin ellos
    if (tcgplayerExtra[e.id]) ficha.tp_id = tcgplayerExtra[e.id].tp;
    if (tcgcollector[e.id]) { ficha.tc_id = tcgcollector[e.id].tc; ficha.tc_slug = tcgcollector[e.id].slug; }
    cartas.push(ficha);
    anadidas++;
  }
  if (anadidas) {
    // el orden de las colecciones se rehace: han entrado algunas nuevas
    const orden2 = Object.keys(sets).sort((a, b) =>
      (sets[a].rel || '9999').localeCompare(sets[b].rel || '9999') || a.localeCompare(b));
    orden2.forEach((id, i) => { sets[id].o = i; });
    cartas.sort((a, b) => (sets[a.s]?.o ?? 9999) - (sets[b.s]?.o ?? 9999)
      || String(a.num).localeCompare(String(b.num), 'en', { numeric: true }));
    console.log(`De pkmncards     ${anadidas} cartas que TCGdex no tiene
`);
  }

  /* 5.6 · el número tal y como está impreso en la carta
     Lo que se enseñaba («SM108/248», «TG03/30», «H09/144») no aparece en
     ninguna carta. Las promos no llevan total, las subcolecciones llevan
     el suyo con sus letras (TG03/TG30) y el Classic Collection lleva el
     número de la carta original. Comprobado mirando las fotos. */
  const impresos = JSON.parse(await readFile(path.join(AQUI, 'numeros-impresos.json'), 'utf8').catch(() => '{}'));
  const esPromo = (nombre) => /\bpromos?\b/i.test(nombre || '');
  // cuántas cartas hay con cada prefijo de letras en cada colección
  const prefijos = {};
  for (const s of setsFichas) {
    if (digitales.has(s.id)) continue;
    const cuenta = {};
    for (const c of s.cards || []) {
      const m = /^([A-Za-z]+)\d/.exec(String(c.localId || ''));
      if (m) cuenta[m[1]] = (cuenta[m[1]] || 0) + 1;
    }
    prefijos[s.id] = cuenta;
  }

  let arreglados = 0;
  for (const c of cartas) {
    if (impresos[c.id]) { c.ni = impresos[c.id]; arreglados++; continue; }
    const set = sets[c.s];
    if (!set) continue;
    if (esPromo(set.n)) { c.ni = String(c.num); arreglados++; continue; }
    const m = /^([A-Za-z]+)\d/.exec(String(c.num));
    const n = m && (prefijos[c.s] || {})[m[1]];
    if (n) { c.ni = `${c.num}/${m[1]}${n}`; arreglados++; }
  }
  console.log(`Números impresos ${arreglados} cartas con numeración propia
`);

  /* 6 · escribir */
  const json = JSON.stringify({ sets, cartas });
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);

  await writeFile(path.join(DATOS, 'catalogo.json'), json);
  await writeFile(path.join(DATOS, 'manifiesto.json'), JSON.stringify({
    version: hash,
    generado: new Date().toISOString().slice(0, 10),
    preciosDe: new Date().toISOString().slice(0, 10),
    cartas: cartas.length,
    sets: Object.keys(sets).length,
    pokemon: pokemon.map(({ dex, id, nombre, tipo, linea, orden, de, principal }) =>
      ({ dex, id, nombre, tipo, linea, orden, de, principal })),
  }, null, 1));

  /* 7 · el parte */
  const items = cartas.reduce((a, c) => a + c.v.length, 0);
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log('─'.repeat(52));
  console.log(`Cartas          ${cartas.length}`);
  console.log(`Coleccionables  ${items}  (carta × variante)`);
  console.log(`Sets            ${Object.keys(sets).length}  (${sets[orden[0]].n} ${sets[orden[0]].rel} → ${sets[orden.at(-1)].n} ${sets[orden.at(-1)].rel})`);
  console.log(`Con imagen      ${cartas.filter((c) => c.img).length} directas` +
    (conRespaldo ? ` + ${conRespaldo} de respaldo` : '') +
    (sinImagen ? ` · ${sinImagen} SIN IMAGEN` : ' · ninguna sin imagen'));
  console.log(`Con precio      ${cartas.filter((c) => c.eur).length} en euros · ${cartas.filter((c) => c.usd).length} en dólares`);
  console.log(`Enlace directo   TCGplayer ${cartas.filter((c) => c.tp_id).length} · TCG Collector ${cartas.filter((c) => c.tc_id).length}`);
  console.log(`catalogo.json   ${kb(json.length)}   versión ${hash}`);
  console.log('─'.repeat(52));

  const porPokemon = {};
  for (const c of cartas) for (const p of c.p) porPokemon[p] = (porPokemon[p] || 0) + 1;
  for (const p of pokemon) {
    console.log(`  ${p.nombre.padEnd(12)} ${String(porPokemon[p.id] || 0).padStart(4)}${p.principal ? '' : '   (familia)'}`);
  }
}

main().catch((e) => { console.error('\n✖', e.message); process.exit(1); });
