/* ===========================================================
   Pokémon Libre · la carta en 3D

   El efecto de cuando se abre un sobre en el juego: la carta llega
   girando, se queda quieta y, si la arrastras con el dedo, se inclina
   y la luz le pasa por encima. Las holo y las raras llevan además una
   capa de foil que cambia de color según cómo la mires.

   Todo el movimiento se hace con cuatro variables CSS que escribe este
   módulo (--rx, --ry, --mx, --my) y que la hoja de estilos usa para
   girar la carta y colocar el brillo. Así el navegador solo compone:
   no se recalcula nada en cada movimiento del dedo.

   Uso:  Carta3D.montar(elemento, nivelDeBrillo)   0 mate · 1 holo · 2 foil
   =========================================================== */
const Carta3D = (() => {
  'use strict';

  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GIRO = 13;        // grados máximos de inclinación

  /** Convierte un elemento en carta inclinable. Devuelve una función
      para soltarla, que hay que llamar al cerrar la ficha. */
  function montar(el, nivel = 0) {
    if (!el || el.dataset.c3d) return () => {};
    el.dataset.c3d = '1';
    el.classList.add('c3d');
    if (nivel > 0) el.classList.add('c3d-brilla');
    if (nivel > 1) el.classList.add('c3d-foil');

    const luz = document.createElement('span');
    luz.className = 'c3d-luz';
    luz.setAttribute('aria-hidden', 'true');
    el.appendChild(luz);

    if (nivel > 0) {
      const holo = document.createElement('span');
      holo.className = 'c3d-holo';
      holo.setAttribute('aria-hidden', 'true');
      el.appendChild(holo);
    }

    if (quieto) return () => {};

    let dentro = false;

    const mover = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;      // 0 izquierda, 1 derecha
      const y = (e.clientY - r.top) / r.height;      // 0 arriba, 1 abajo
      el.style.setProperty('--ry', `${(x - .5) * 2 * GIRO}deg`);
      el.style.setProperty('--rx', `${(.5 - y) * 2 * GIRO}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
      if (!dentro) { dentro = true; el.classList.add('c3d-viva'); }
    };

    const soltar = () => {
      dentro = false;
      el.classList.remove('c3d-viva');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    };

    /* En el móvil no hay ratón: la carta se inclina arrastrando el dedo
       por encima. Se corta el desplazamiento de la hoja mientras dura,
       porque si no la hoja se va hacia abajo en vez de girar la carta. */
    const tocar = (e) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      mover(e.touches[0]);
    };

    el.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') mover(e); });
    el.addEventListener('pointerleave', soltar);
    el.addEventListener('touchstart', tocar, { passive: false });
    el.addEventListener('touchmove', tocar, { passive: false });
    el.addEventListener('touchend', soltar);
    el.addEventListener('touchcancel', soltar);

    return soltar;
  }

  /** Cuánto brilla una carta, por lo que dice el catálogo. Una común de
      1999 es de cartón mate; una illustration rare de 2024 es un espejo. */
  function nivelDe(carta) {
    const r = (carta.r || '').toLowerCase();
    if (/secret|rainbow|illustration|hyper|gold|shiny|star|prism/.test(r)) return 2;
    if (/ultra|double rare|holo|\bex\b|\bgx\b|\bv\b|vmax|vstar|radiant|amazing|legend/.test(r)) return 2;
    if (/rare/.test(r)) return 1;
    const v = carta.v || [];
    if (v.includes('holo') || v.includes('reverse')) return 1;
    return 0;
  }

  return { montar, nivelDe };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Carta3D;
