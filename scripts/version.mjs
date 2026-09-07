/* ===========================================================
   Pokémon Libre · sellar la versión
   Pone ?v=<sello> en cada hoja de estilo y cada script de index.html,
   y el mismo sello en el nombre del depósito del service worker.

   Por qué: GitHub Pages sirve los ficheros con diez minutos de caché.
   Sin esto, al publicar una corrección el navegador sigue ejecutando
   el código viejo y parece que el arreglo no funciona. Pasó de verdad
   y costó dos diagnósticos equivocados.

     node scripts/version.mjs         sella con la fecha y la hora
     node scripts/version.mjs 7f3a    sella con lo que se le diga
   =========================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const sello = process.argv[2]
  || new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);

const conVersion = (ruta) => `${ruta.split('?')[0]}?v=${sello}`;

const html = (await readFile(path.join(RAIZ, 'index.html'), 'utf8'))
  .replace(/(<link[^>]+href=")([^"]+\.css)(?:\?[^"]*)?(")/g, (_, a, r, b) => a + conVersion(r) + b)
  .replace(/(<script[^>]+src=")([^"]+\.js)(?:\?[^"]*)?(")/g, (_, a, r, b) => a + conVersion(r) + b);
await writeFile(path.join(RAIZ, 'index.html'), html);

const sw = (await readFile(path.join(RAIZ, 'sw.js'), 'utf8'))
  .replace(/const CACHE = '[^']+'/, `const CACHE = 'pokemon-libre-${sello}'`)
  // el armazón que se guarda al instalar debe pedir las mismas direcciones
  .replace(/(\s')([^']+\.(?:css|js))(?:\?v=[^']*)?(')/g, (_, a, r, b) => a + conVersion(r) + b);
await writeFile(path.join(RAIZ, 'sw.js'), sw);

const cuantos = (html.match(/\?v=/g) || []).length;
console.log(`Sellado con «${sello}»: ${cuantos} ficheros en index.html y el depósito del service worker.`);
