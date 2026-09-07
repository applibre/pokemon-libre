/* Pokémon Libre · trabajador de servicio

   Dos estrategias distintas a propósito:
   · el armazón y el catálogo se guardan al instalar (son 200 KB)
   · las 1752 imágenes NO: pesan 76 MB. Cada carta que miras queda
     guardada, así que tu colección se ve sin internet sin haber
     descargado nunca las que no te interesan.

   El nombre del depósito sube en cada despliegue: así el navegador
   tira lo viejo en vez de servir una versión a medias. */

const CACHE = 'pokemon-libre-v2';
const IMAGENES = 'pokemon-libre-img-v1';

const ARMAZON = [
  './', 'index.html', 'css/style.css',
  'js/dominio.js', 'js/almacen.js', 'js/estado.js', 'js/interfaz.js',
  'js/vistas/inicio.js', 'js/vistas/cartas.js', 'js/vistas/faltan.js', 'js/vistas/ajustes.js',
  'js/app.js', 'manifest.json', 'data/catalogo.json', 'data/manifiesto.json',
  'icono-192.png', 'icono-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARMAZON.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== IMAGENES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // imágenes: primero la copia guardada; si no está, se baja y se guarda
  if (url.pathname.includes('/data/cartas/') || url.pathname.includes('/data/sets/')) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(IMAGENES).then((c) => c.put(e.request, copia));
        }
        return res;
      }).catch(() => new Response('', { status: 404 })))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
