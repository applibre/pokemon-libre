/* ===========================================================
   Pokémon Libre · dejar las novedades esperando tu aprobación

     node scripts/preparar-novedades.mjs <catalogo-publicado.json>

   El buscador semanal genera un catálogo con las cartas nuevas. Aquí esas
   cartas se apartan a data/novedades.json y el catálogo publicado vuelve
   a quedar EXACTAMENTE como estaba: nada entra en tu colección hasta que
   pulsas «Añadir» en la app.

   Salida: 0 = hay algo nuevo que preguntarte · 3 = lo mismo que ya estaba esperando
   =========================================================== */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'data');
const basePath = process.argv[2];

const base = JSON.parse(await readFile(basePath, 'utf8'));
const generado = JSON.parse(await readFile(path.join(DATOS, 'catalogo.json'), 'utf8'));
const previo = JSON.parse(await readFile(path.join(DATOS, 'novedades.json'), 'utf8').catch(() => '{"cartas":[]}'));

const conocidas = new Set(base.cartas.map((c) => c.id));
const cartas = generado.cartas.filter((c) => !conocidas.has(c.id));
const usados = new Set(cartas.map((c) => c.s));
const sets = Object.fromEntries(Object.entries(generado.sets).filter(([id]) => !base.sets[id] && usados.has(id)));
const orden = Object.fromEntries(Object.entries(generado.sets).map(([id, s]) => [id, s.o]));

// el catálogo publicado, intacto
await copyFile(basePath, path.join(DATOS, 'catalogo.json'));
execFileSync('git', ['checkout', '--', 'data/manifiesto.json'], { cwd: RAIZ });

await writeFile(path.join(DATOS, 'novedades.json'), JSON.stringify({
  generado: new Date().toISOString().slice(0, 10), cartas, sets, orden,
}));

const antes = new Set(previo.cartas.map((c) => c.id));
const nuevasDeVerdad = cartas.filter((c) => !antes.has(c.id));
console.log(`Esperando tu aprobación: ${cartas.length} cartas · nuevas desde la última vez: ${nuevasDeVerdad.length}`);
process.exit(nuevasDeVerdad.length ? 0 : 3);
