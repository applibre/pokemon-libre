/* ===========================================================
   Pokémon Libre · rescate desde Bulbapedia
   Para las cartas que no existen ni en TCGdex ni en pokemontcg.io
   (kits de entrenamiento, promos recientes, McDonald's). Bulbapedia
   las tiene todas, con imágenes en archives.bulbagarden.net.

   Misma regla estricta que el otro rescate: el nombre del fichero
   debe contener el nombre de la carta, su número Y una marca del set.
   Si falta cualquiera de los tres, no se acepta.

     node scripts/rescate-bulbapedia.mjs
   Añade lo que encuentra a scripts/imagenes-rescatadas.json.
   =========================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const API = 'https://bulbapedia.bulbagarden.net/w/api.php';
const ARCHIVES = 'https://archives.bulbagarden.net/w/api.php';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, base = API) {
  const u = `${base}?${new URLSearchParams({ ...params, format: 'json' })}`;
  const r = await fetch(u, {
    headers: { 'User-Agent': 'PokemonLibre/1.0 (coleccion personal; applibre)' },
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const plano = (t) => String(t || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/* Cómo llama Bulbapedia a cada set en el nombre de fichero, y cómo se
   llama la página del set para buscar. Solo los que hacen falta. */
const SETS = {
  'mep':        { marca: ['meppromo'], pagina: 'MEP Black Star Promos',
                  cortos: ['MEP Promo'] },
  'svp':        { marca: ['svppromo'], pagina: 'SVP Black Star Promos',
                  cortos: ['SVP Promo'] },
  'mfb':        { marca: ['myfirstbattle'], pagina: 'My First Battle',
                  cortos: ['My First Battle'] },
  '2023sv':     { marca: ['mcdonaldscollection2023'], pagina: "McDonald's Collection 2023",
                  cortos: ["McDonald's Collection 2023"] },
  '2024sv':     { marca: ['mcdonaldscollection2024'], pagina: "McDonald's Collection 2024",
                  cortos: ["McDonald's Collection 2024"] },
  'tk-hs-r':    { marca: ['raichuhalfdeck', 'hstrainerkit'], excluye: ['alolan'], pagina: 'HS Trainer Kit',
                  cortos: ['HS Trainer Kit Raichu', 'HS Trainer Kit', 'HS Trainer Kit: Raichu'] },
  'tk-xy-p':    { marca: ['pikachulibrehalfdeck', 'xytrainerkit'], pagina: 'XY Trainer Kit: Pikachu Libre & Suicune',
                  cortos: ['XY Trainer Kit: Pikachu Libre', 'XY Trainer Kit Pikachu Libre', 'XY Trainer Kit'] },
  'tk-sm-r':    { marca: ['alolanraichuhalfdeck', 'smtrainerkit'], pagina: 'Sun & Moon Trainer Kit: Lycanroc & Alolan Raichu',
                  cortos: ['Sun & Moon Trainer Kit: Alolan Raichu', 'Sun & Moon Trainer Kit Alolan Raichu', 'SM Trainer Kit Alolan Raichu', 'Sun & Moon Trainer Kit'] },
  'ecard3':     { marca: ['skyridge'], pagina: 'Skyridge',
                  cortos: ['Skyridge'] },
  'ex5.5':      { marca: ['pokecardcreator', 'cardcreator'], pagina: 'Poké Card Creator Pack',
                  cortos: ['Poké Card Creator Pack', 'Pokémon Card Creator Pack'] },
  'swsh12.5gg': { marca: ['crownzenith', 'galariangallery'], pagina: 'Crown Zenith',
                  cortos: ['Crown Zenith'] },
};

/* El número tal como suele ir en el fichero: sin ceros a la izquierda,
   y las letras de sección (H09, GG30) pegadas. */
const numeros = (num) => {
  const n = String(num);
  const sinCeros = n.replace(/^0+(\d)/, '$1');
  const letrasSinCeros = n.replace(/^([A-Za-z]+)0+/, '$1');
  return [...new Set([plano(n), plano(sinCeros), plano(letrasSinCeros)])].filter(Boolean);
};

function encaja(fichero, carta) {
  const f = plano(fichero.replace(/^File:/, '').replace(/\.(jpe?g|png|webp)$/i, ''));
  const set = SETS[carta.s];
  if (!set) return false;
  const nombre = plano(carta.n);
  if (!f.includes(nombre)) return false;
  if (!set.marca.some((m) => f.includes(m))) return false;
  if ((set.excluye || []).some((x) => f.includes(x))) return false;
  if (numeros(carta.num).some((n) => f.endsWith(n) || f.includes(n))) return true;
  // promos sin número impreso: solo si el fichero es exactamente nombre+marca
  return set.marca.some((m) => f === nombre + m);
}

/* Lista de TODOS los ficheros de Bulbapedia que empiezan por el nombre
   de la carta (sin espacios). Es la vía para los sets que no tienen
   página por carta: kits de entrenamiento, McDonald's, My First Battle. */
const cachePrefijo = new Map();
async function ficherosPorPrefijo(nombre) {
  const prefijo = nombre.replace(/[^A-Za-z0-9]/g, '');
  if (cachePrefijo.has(prefijo)) return cachePrefijo.get(prefijo);
  const todos = [];
  let cont = null;
  for (let i = 0; i < 12; i++) {
    // las imágenes viven en el wiki Archives, no en Bulbapedia
    const r = await api({ action: 'query', list: 'allimages', aiprefix: prefijo, ailimit: 500,
      ...(cont ? { aicontinue: cont } : {}) }, ARCHIVES);
    todos.push(...(r.query?.allimages || []).map((x) => x.name));
    cont = r.continue?.aicontinue;
    if (!cont) break;
    await dormir(200);
  }
  cachePrefijo.set(prefijo, todos);
  return todos;
}

async function imagenesDe(titulo) {
  const r = await api({ action: 'query', titles: titulo, prop: 'images', imlimit: 300, redirects: 1 });
  const paginas = Object.values(r.query?.pages || {});
  return paginas.flatMap((p) => (p.images || []).map((i) => i.title));
}

async function urlDe(fichero) {
  const titulo = fichero.startsWith('File:') ? fichero : `File:${fichero}`;
  for (const base of [ARCHIVES, API]) {
    const r = await api({ action: 'query', titles: titulo, prop: 'imageinfo', iiprop: 'url|size' }, base);
    const p = Object.values(r.query?.pages || {})[0];
    const ii = p?.imageinfo?.[0];
    if (ii && ii.width >= 200) return ii.url;
  }
  return null;
}

async function main() {
  const cat = JSON.parse(await readFile(path.join(RAIZ, 'data', 'catalogo.json'), 'utf8'));
  const ruta = path.join(AQUI, 'imagenes-rescatadas.json');
  const rescatadas = JSON.parse(await readFile(ruta, 'utf8').catch(() => '{}'));

  const sin = cat.cartas.filter((c) => !c.img && !rescatadas[c.id]);
  console.log(`Sin foto: ${sin.length}\n`);

  // Las imágenes de la página del set, una sola vez por set
  const porSet = {};
  for (const sid of new Set(sin.map((c) => c.s))) {
    const def = SETS[sid];
    if (!def) { console.log(`  ? ${sid}: sin página conocida`); continue; }
    try {
      porSet[sid] = await imagenesDe(`${def.pagina} (TCG)`);
      if (!porSet[sid].length) porSet[sid] = await imagenesDe(def.pagina);
      console.log(`  ${def.pagina}: ${porSet[sid].length} ficheros en la página`);
    } catch (e) { console.log(`  ✖ ${def.pagina}: ${e.message}`); porSet[sid] = []; }
    await dormir(300);
  }
  console.log('');

  let nuevas = 0;
  const fallidas = [];
  for (const c of sin) {
    let candidatos = (porSet[c.s] || []).filter((f) => encaja(f, c));

    // si la página del set no la trae, la página de la propia carta:
    // Bulbapedia las titula «Nombre (Set Número)»
    if (!candidatos.length && SETS[c.s]) {
      const nums = [String(c.num), String(c.num).replace(/^0+(\d)/, '$1'), String(c.num).replace(/^([A-Z]+)0+/, '$1')];
      const titulos = [];
      for (const corto of SETS[c.s].cortos) for (const n of new Set(nums)) titulos.push(`${c.n} (${corto} ${n})`);
      try {
        for (const t of titulos) {
          const imgs = await imagenesDe(t);
          candidatos = imgs.filter((f) => encaja(f, c));
          if (candidatos.length) break;
          await dormir(150);
        }
        if (!candidatos.length) {
          const q = await api({ action: 'query', list: 'search', srlimit: 4,
            srsearch: `"${c.n}" ${SETS[c.s].cortos[0]} ${nums[1]}` });
          for (const r of q.query?.search || []) {
            const imgs = await imagenesDe(r.title);
            candidatos = imgs.filter((f) => encaja(f, c));
            if (candidatos.length) break;
            await dormir(150);
          }
        }
      } catch (_) {}
    }

    if (!candidatos.length && SETS[c.s]) {
      try {
        const lista = await ficherosPorPrefijo(c.n);
        candidatos = lista.filter((f) => encaja(f, c));
      } catch (_) {}
    }

    if (!candidatos.length) { fallidas.push(c); continue; }
    const url = await urlDe(candidatos[0]);
    if (!url) { fallidas.push(c); continue; }
    rescatadas[c.id] = url;
    nuevas++;
    console.log(`  ✓ ${c.id.padEnd(16)} ${c.n.padEnd(26)} ← ${candidatos[0].replace('File:', '')}`);
    await dormir(250);
  }

  await writeFile(ruta, JSON.stringify(rescatadas, null, 1));
  console.log(`\n${'─'.repeat(52)}\nRescatadas de Bulbapedia: ${nuevas} de ${sin.length}`);
  if (fallidas.length) {
    console.log(`\nSiguen sin foto (${fallidas.length}):`);
    for (const c of fallidas) console.log(`  · ${c.id.padEnd(16)} ${c.n.padEnd(26)} ${cat.sets[c.s].n}`);
  }
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
