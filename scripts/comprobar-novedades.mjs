/* ===========================================================
   Pokémon Libre · la comprobación que decide si una novedad se propone

     node scripts/comprobar-novedades.mjs <catalogo-publicado.json>

   Compara el catálogo publicado con el recién generado y solo deja pasar
   un cambio que SUMA:
     · cada carta que ya estaba sigue ahí, idéntica (mismo id, mismos datos);
     · cada colección que ya estaba sigue ahí;
     · cada carta nueva tiene su imagen pequeña y su imagen grande;
     · ningún enlace externo se ha colado en el catálogo.
   Escribe scripts/.cache/resumen.md con lo que entra.

   Salida: 0 = hay novedades válidas · 3 = no hay nada nuevo · 1 = algo no cuadra
   =========================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(await readFile(process.argv[2], 'utf8'));
const ahora = JSON.parse(await readFile(path.join(RAIZ, 'data', 'catalogo.json'), 'utf8'));
const problemas = [];

const porId = new Map(ahora.cartas.map((c) => [c.id, c]));
for (const c of base.cartas) {
  const n = porId.get(c.id);
  if (!n) problemas.push(`falta la carta ${c.id} (${c.n})`);
  else if (!isDeepStrictEqual(n, c)) problemas.push(`la carta ${c.id} (${c.n}) ha cambiado`);
}
for (const [id, s] of Object.entries(base.sets)) {
  const n = ahora.sets[id];
  if (!n) problemas.push(`falta la colección ${id} (${s.n})`);
  else {
    const { o: _a, ...x } = s; const { o: _b, ...y } = n;
    if (!isDeepStrictEqual(x, y)) problemas.push(`la colección ${id} (${s.n}) ha cambiado`);
  }
}

const conocidas = new Set(base.cartas.map((c) => c.id));
const nuevas = ahora.cartas.filter((c) => !conocidas.has(c.id));
for (const c of nuevas) {
  for (const f of [`data/cartas/${c.id}.webp`, `data/cartas/g/${c.id}.webp`]) {
    if (!existsSync(path.join(RAIZ, f))) problemas.push(`la carta nueva ${c.id} no tiene ${f}`);
  }
  if (!c.p?.length) problemas.push(`la carta nueva ${c.id} no pertenece a ningún Pokémon`);
  if (!ahora.sets[c.s]) problemas.push(`la carta nueva ${c.id} apunta a una colección que no existe (${c.s})`);
}
if (/https?:\/\//.test(JSON.stringify(ahora))) problemas.push('el catálogo contiene enlaces externos');
const sinFoto = JSON.parse(await readFile(path.join(RAIZ, 'scripts', 'sin-foto.json'), 'utf8').catch(() => '[]'));
if (sinFoto.length) problemas.push(`cartas con ficha dibujada en vez de foto: ${sinFoto.join(', ')}`);

if (problemas.length) {
  console.error('✖ El catálogo nuevo NO se propone:\n  - ' + problemas.join('\n  - '));
  process.exit(1);
}
if (!nuevas.length) { console.log('Nada nuevo.'); process.exit(3); }

const nuevosSets = Object.keys(ahora.sets).filter((id) => !base.sets[id]);
const porSet = new Map();
for (const c of nuevas) porSet.set(c.s, [...(porSet.get(c.s) || []), c]);
const lineas = [
  `**${nuevas.length} cartas nuevas** de tus Pokémon, en ${porSet.size} colección(es)` +
    (nuevosSets.length ? ` (${nuevosSets.length} colección nueva)` : '') + '.',
  '',
  ...[...porSet].map(([sid, cs]) => {
    const s = ahora.sets[sid];
    const lengua = s.ja ? 'JP' : 'EN';
    const cuales = cs.slice(0, 8).map((c) => `${c.n} ${c.ni || c.num}`).join(', ') + (cs.length > 8 ? ` y ${cs.length - 8} más` : '');
    return `- **${s.n}** (${lengua}${nuevosSets.includes(sid) ? ', colección nueva' : ''}): ${cs.length} — ${cuales}`;
  }),
  '',
  `Lo que ya tenías (${base.cartas.length} cartas y ${Object.keys(base.sets).length} colecciones) queda idéntico. Tus marcas no se tocan.`,
];
await mkdir(path.join(RAIZ, 'scripts', '.cache'), { recursive: true });
await writeFile(path.join(RAIZ, 'scripts', '.cache', 'resumen.md'), lineas.join('\n') + '\n');
console.log(lineas.join('\n'));
