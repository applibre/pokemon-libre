/* ===========================================================
   Pokémon Libre · rescate de imágenes
   TCGdex no tiene imagen de unas 70 cartas (promos, McDonald's,
   kits de entrenamiento). pokemontcg.io sí las tiene, pero nombra
   los sets de otra manera.

   Aquí NO se adivina: se descargan los datos de pokemontcg.io y
   solo se acepta una imagen si coinciden el número de la carta Y
   el nombre. Una imagen equivocada es peor que ninguna, porque el
   coleccionista marcaría la carta que no es.
   =========================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const CACHE = path.join(AQUI, '.cache');
const CRUDO = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';

/* Equivalencias de set entre las dos fuentes. Cada set solo apunta a
   su propio equivalente: nunca a otro producto. Emparejar «My First
   Battle» con una promo suelta porque ambas tienen un Bulbasaur daría
   la imagen de otra carta, y el coleccionista marcaría la que no es. */
const EQUIVALE = {
  'sm3.5': ['sm35'],
  'svp': ['svp'],
  'smp': ['smp'],
  'swshp': ['swshp'],
  'sm7.5': ['sm75'],
  'ecard3': ['ecard3'],
  'ex5.5': ['ex5', 'ex55'],
  'bog': ['bp'],
  'cel25cc': ['cel25c'],
  '2014xy': ['mcd14'], '2015xy': ['mcd15'], '2016xy': ['mcd16'],
  '2017sm': ['mcd17'], '2018sm': ['mcd18'], '2019sm': ['mcd19'],
  '2021swsh': ['mcd21'], '2022swsh': ['mcd22'], '2023sv': ['mcd23'], '2024sv': ['mcd24'],
  'tk-ex-latio': ['tk1b'], 'tk-ex-latia': ['tk1a'],
  'tk-ex-m': ['tk2b'], 'tk-ex-p': ['tk2a'],
  'tk-hs-r': ['hsp', 'hgss1'], 'tk-hs-g': ['hgss1'],
  'tk-sm-r': ['smp', 'sm1'], 'tk-xy-p': ['xyp', 'xy1'],
  'tk-bw-e': ['bw1'], 'tk-bw-z': ['bw1'],
};

/* Sets que son el mismo producto en ambas fuentes pero con la
   numeración escrita de otra forma. Solo en estos se permite casar
   por nombre. */
const MISMO_PRODUCTO = new Set(['cel25cc', 'swsh4.5sv']);

const normaliza = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '');

async function bajaSet(id) {
  const f = path.join(CACHE, `ptcg-${id}.json`);
  if (existsSync(f)) { try { return JSON.parse(await readFile(f, 'utf8')); } catch (_) {} }
  const r = await fetch(`${CRUDO}/cards/en/${id}.json`);
  if (!r.ok) return null;
  const j = await r.json();
  await writeFile(f, JSON.stringify(j));
  return j;
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const cat = JSON.parse(await readFile(path.join(RAIZ, 'data', 'catalogo.json'), 'utf8'));
  const sin = cat.cartas.filter((c) => !c.img);
  console.log(`Cartas sin imagen: ${sin.length}\n`);

  const rescatadas = {};
  const fallidas = [];

  for (const c of sin) {
    const candidatos = EQUIVALE[c.s] || [c.s.replace(/[.-]/g, '')];
    let hallada = null;

    for (const setId of candidatos) {
      const cartas = await bajaSet(setId);
      if (!cartas) continue;

      // mismo número y mismo nombre: si algo no encaja, no se acepta
      const igual = cartas.find((x) =>
        normaliza(x.number) === normaliza(c.num) && normaliza(x.name) === normaliza(c.n));

      if (igual?.images?.small) { hallada = { url: igual.images.small, set: setId, via: 'num+nombre' }; break; }

      /* Segundo intento, solo dentro del MISMO producto: hay sets donde
         las dos fuentes numeran distinto (CC001 frente a CC1). Se acepta
         únicamente si en ese set hay una sola carta con ese nombre. */
      if (MISMO_PRODUCTO.has(c.s)) {
        const porNombre = cartas.filter((x) => normaliza(x.name) === normaliza(c.n));
        if (porNombre.length === 1 && porNombre[0].images?.small) {
          hallada = { url: porNombre[0].images.small, set: setId, via: 'nombre en el mismo set' };
          break;
        }
      }
    }

    if (hallada) {
      rescatadas[c.id] = hallada.url;
      console.log(`  ✓ ${c.id.padEnd(16)} ${c.n.padEnd(22)} ← ${hallada.set} (${hallada.via})`);
    } else {
      fallidas.push(c);
    }
  }

  await writeFile(path.join(AQUI, 'imagenes-rescatadas.json'),
    JSON.stringify(rescatadas, null, 1));

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`Rescatadas: ${Object.keys(rescatadas).length} de ${sin.length}`);
  if (fallidas.length) {
    console.log(`\nSiguen sin imagen (${fallidas.length}):`);
    for (const c of fallidas) console.log(`  · ${c.id.padEnd(16)} ${c.n.padEnd(22)} ${cat.sets[c.s].n}`);
  }
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
