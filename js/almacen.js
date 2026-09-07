/* ===========================================================
   Pokémon Libre · almacén
   La colección vive en este dispositivo. Como no hay servidor ni
   cuenta, perderla sería definitivo: por eso se guarda con red.

   · si los datos vienen corruptos, se apartan, no se destruyen
   · antes de la primera escritura de cada día se deja una copia
   · se pide al navegador que no borre nada por falta de espacio
   =========================================================== */
const Almacen = (() => {
  'use strict';

  const CLAVE = 'pokemon-libre';
  const COPIA = 'pokemon-libre-copia';
  const VERSION = 1;

  const inicial = () => ({
    schemaVersion: VERSION,
    coleccion: {},            // { 'base1-4': { holo: 1 } }
    ajustes: {
      tema: 'auto',
      verFamilias: true,      // las preevoluciones, incluidas
      verPrecios: true,
      moneda: 'eur',
    },
    creado: null,
    ultimaCopia: null,
  });

  const migraciones = [];     // de la versión 1 a la 2 iría aquí

  function migrar(d) {
    let v = d.schemaVersion || 1;
    while (v - 1 < migraciones.length) { d = migraciones[v - 1](d); v++; d.schemaVersion = v; }
    return d;
  }

  function leer() {
    let crudo;
    try { crudo = localStorage.getItem(CLAVE); } catch (_) { return inicial(); }
    if (!crudo) return inicial();
    try {
      const d = JSON.parse(crudo);
      if (!d || typeof d !== 'object') throw new Error('no es un objeto');
      const base = inicial();
      return migrar({ ...base, ...d, ajustes: { ...base.ajustes, ...(d.ajustes || {}) } });
    } catch (_) {
      // No se borra: se aparta con otro nombre por si se puede rescatar
      try { localStorage.setItem(CLAVE + '-corrupto-' + Date.now(), crudo); } catch (__) {}
      return inicial();
    }
  }

  function copiaDelDia(anterior) {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const previa = JSON.parse(localStorage.getItem(COPIA) || 'null');
      if (previa && previa.dia === hoy) return;
      if (!anterior) return;
      localStorage.setItem(COPIA, JSON.stringify({ dia: hoy, datos: anterior }));
    } catch (_) {}
  }

  const leerCopia = () => {
    try { return JSON.parse(localStorage.getItem(COPIA) || 'null'); } catch (_) { return null; }
  };

  let avisoEspacio = null;
  const alQuedarseSinEspacio = (fn) => { avisoEspacio = fn; };

  function guardar(datos) {
    let anterior = null;
    try { anterior = localStorage.getItem(CLAVE); } catch (_) {}
    copiaDelDia(anterior ? JSON.parse(anterior) : null);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
      return { ok: true };
    } catch (e) {
      const lleno = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      if (lleno && avisoEspacio) avisoEspacio();
      return { ok: false, lleno: !!lleno };
    }
  }

  const borrarTodo = () => {
    try { localStorage.removeItem(CLAVE); localStorage.removeItem(COPIA); } catch (_) {}
  };

  /* El navegador puede tirar los datos si necesita espacio. Pedir que
     no lo haga es gratis, y Chrome lo concede solo si el sitio se usa. */
  async function pedirPermanencia() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (_) {}
    return false;
  }

  return { leer, guardar, borrarTodo, leerCopia, alQuedarseSinEspacio, pedirPermanencia, inicial, VERSION };
})();
