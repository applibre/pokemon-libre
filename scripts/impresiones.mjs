/* ===========================================================
   Pokémon Libre · cómo se llama cada impresión, en castellano

   TCGdex describe cada impresión de una carta con tres cosas: el tipo
   (normal, holo, reverse), un subtipo (shadowless, unlimited…) y unos
   sellos (1.ª edición, un campeonato, una promoción). Aquí se traducen
   a algo que se entienda, porque «poketour-99» no le dice nada a nadie
   y «Poké Tour '99» sí.

   Lo que no esté en el diccionario se enseña tal cual viene, con
   guiones por espacios: preferible a inventarse un nombre.
   =========================================================== */

export const TIPO = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse holo',
  lenticular: 'Lenticular',
  firstEdition: '1.ª edición',
  wPromo: 'Promo',
};

export const SUBTIPO = {
  unlimited: 'Unlimited',
  shadowless: 'Shadowless',
  'shadowless-red-cheek': 'Shadowless de mejillas rojas',
  '1999-2000-copyright': 'Copyright 1999-2000',
  'missing-expansion-symbol': 'Sin símbolo de expansión',
  'd-ink-dot-error': 'Error del punto de tinta',
  'energy-symbol-error': 'Error del símbolo de energía',
  'japanese-back': 'Con dorso japonés',
  'blue-border': 'Borde azul',
};

export const SELLO = {
  '1st-edition': '1.ª edición',
  '1st-edition-error': '1.ª edición con error',
  'pre-release': 'Prerelease',
  staff: 'Staff',
  winner: 'Winner',
  'set-logo': 'Con el logo del set',
  'w-promo': 'Promo de Wizards',
  wotc: 'Sello de Wizards',
  'poketour-99': "Poké Tour '99",
  'pikachu-tail': 'Variante del rabo',
  'grey-star': 'Estrella gris',
  '1st-movie': 'Primera película',
  '1st-movie-inverted': 'Primera película, invertido',
  '10th-anniversary': '10.º aniversario',
  '25th-celebration': '25.º aniversario',
  '30th-pokeday': '30.º Pokémon Day',
  'city-championships': 'Campeonato de ciudad',
  'state-championships': 'Campeonato estatal',
  'national-championships': 'Campeonato nacional',
  'regional-championships': 'Campeonato regional',
  'worlds-2024': 'Mundial 2024',
  'worlds-2025': 'Mundial 2025',
  'asia-2023-24': 'Campeonato de Asia 2023-24',
  'chicago-2009': 'Chicago 2009',
  'gym-challenge': 'Gym Challenge',
  'player-rewards-program': 'Player Rewards',
  'countdown-calendar': 'Calendario de cuenta atrás',
  'pokemon-day': 'Pokémon Day',
  'pokemon-center': 'Pokémon Center',
  'pokemon-together': 'Pokémon Together',
  'nintendo-world': 'Nintendo World',
  'comic-con': 'Comic-Con',
  'illustration-contest-2022': 'Concurso de ilustración 2022',
  'illustration-contest-2024': 'Concurso de ilustración 2024',
  mcdonalds: "McDonald's",
  gamestop: 'GameStop',
  'eb-games': 'EB Games',
  'rain-city': 'Rain City',
  horizons: 'Horizons',
  platinum: 'Platino',
  snowflake: 'Copo de nieve',
  pokeball: 'Poké Ball',
  pikachu: 'Sello de Pikachu',
  bulbasaur: 'Sello de Bulbasaur',
  charmander: 'Sello de Charmander',
  squirtle: 'Sello de Squirtle',
  'hiroki-yano': 'Firmada por Hiroki Yano',
  'jason-martinez': 'Firmada por Jason Martinez',
  'ross-cawthorn': 'Firmada por Ross Cawthorn',
};

const bonito = (t) => String(t).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Una línea por impresión: «Holo · 1.ª edición», «Normal · Shadowless». */
export function impresionesDe(carta) {
  const vs = carta.variants_detailed || [];
  const salida = [];
  for (const v of vs) {
    const partes = [TIPO[v.type] || bonito(v.type)];
    if (v.subtype) partes.push(SUBTIPO[v.subtype] || bonito(v.subtype));
    for (const s of v.stamp || []) partes.push(SELLO[s] || bonito(s));
    if (v.size && v.size !== 'standard') partes.push(bonito(v.size));
    const linea = partes.join(' · ');
    if (!salida.includes(linea)) salida.push(linea);
  }
  return salida;
}
