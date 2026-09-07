# Pokémon Libre

**Todas las cartas de tus Pokémon, de todos los sets.** Marca las que tienes, descubre las que te faltan y llévate la lista a la tienda. Gratis, sin cuenta, sin anuncios y sin suscripción.

👉 **[applibre.github.io/pokemon-libre](https://applibre.github.io/pokemon-libre/)**

---

## Para quién es

Para quien colecciona **un Pokémon**, no un set. Todos los Charizard. Todos los Gengar. Todos los Pikachu que existen, desde el Base Set de 1999 hasta hoy.

Es un hueco real: las apps del mercado piensan por colección —bloque, set, carta— y para ver «todos los Gengar» te obligan a buscarlos uno a uno. La única que sí tiene vista por Pokémon te cobra una suscripción mensual por dejarte marcar tu progreso en ella.

## Qué trae

**876 cartas** de 17 Pokémon, repartidas en **139 colecciones** publicadas entre enero de 1999 y marzo de 2026:

| | |
|---|---|
| Pikachu 194 · Gengar 51 · Snorlax 56 | los tres que empezaron esto |
| Charmander 48 · Charmeleon 38 · Charizard 116 | la línea de fuego |
| Bulbasaur 31 · Ivysaur 23 · Venusaur 53 | la de planta |
| Squirtle 31 · Wartortle 21 · Blastoise 49 | la de agua |
| Gastly 35 · Haunter 32 · Pichu 16 · Raichu 77 · Munchlax 5 | las preevoluciones, opcionales |

Se reúnen por **número de Pokédex**, no por nombre: así entran «Reshiram & Charizard GX» o «Sabrina's Gengar», y se quedan fuera los Entrenadores que solo llevan el nombre.

## Qué hace

**Un toque = la tengo.** La carta se enciende en dorado y sube el contador. Otro toque la quita. Puedes pasar un fajo entero sin abrir nada.

**Las variantes, en la propia carta.** Holo, reverse, primera edición, promo: cada una con su cantidad, en la misma ficha. Ninguna otra app lo hace sin mandarte a otra pantalla.

**Lo que te falta, listo para la tienda.** Por Pokémon o de todo, con el precio orientativo y un botón para mandarlo por WhatsApp o copiarlo.

**Funciona sin internet.** Las 876 cartas y sus imágenes viven dentro de la app.

## Lo que no hace

- **No escanea con la cámara.** Todas las apps lo cobran y todas lo hacen mal.
- **No es una cartera de inversión.** El precio está para decidir una compra, no para mirarse el patrimonio.
- **No trae datos de juego.** Ni ataques, ni HP, ni legalidad de torneo: ruido para quien colecciona.
- **No pide cuenta.** No hay nada que crear ni nada que iniciar.

## Dónde viven tus datos

En tu dispositivo, y en ningún sitio más. Eso tiene una contrapartida: **si borras los datos del navegador, se van.** Por eso hay copia de seguridad en Ajustes, y conviene usarla. En iPhone, además, instálala en la pantalla de inicio: Safari borra el almacenamiento de las webs que no visitas en siete días, pero respeta las apps instaladas.

La app oficial de Pokémon para catalogar cartas cerró en 2023 avisando de que los datos «no serán exportables ni transferibles de ninguna manera». Aquí eso no puede pasar.

## Las imágenes

Las 876 cartas están descargadas en el repositorio, en dos tamaños (245 px para la rejilla, 600 px para la ficha). No se enlaza a ningún servidor ajeno: la API que usaba medio sector cerró y pasó a ser de pago, y una colección no puede quedarse sin fotos por eso.

De las 876, **867 tienen su foto real** (TCGdex, pokemontcg.io y Bulbagarden Archives, siempre comprobando que nombre, número y colección coinciden). Las 9 restantes —McDonald's 2023 y 2024, el Poké Card Creator Pack, el holo H9 de Skyridge, dos Pikachu del HS Trainer Kit y los dos Pikachu Libre del XY Trainer Kit (de los que Bulbapedia solo tiene el promo japonés, que es otra carta)— no existen escaneadas en ninguna fuente pública; llevan una ficha con su nombre, colección y número, y se marcan igual que las demás.

## Cómo se genera el catálogo

Cuatro pasos, todos con caché para poder repetirlos sin castigar a la fuente:

```bash
node scripts/catalogo.mjs        # baja las cartas de TCGdex por número de Pokédex
node scripts/rescate-imagenes.mjs # busca las que faltan en pokemontcg.io
node scripts/rescate-bulbapedia.mjs # y las que siguen faltando, en Bulbagarden Archives
python scripts/bajar-imagenes.py  # descarga las imágenes al repositorio
```

Para añadir un Pokémon basta con una línea en `scripts/objetivos.json`.

Regla del rescate: solo se acepta una imagen si **coinciden el número y el nombre** de la carta. Una imagen equivocada es peor que ninguna, porque marcarías la carta que no es.

## Para quien quiera tocar el código

Sin compilar, sin dependencias, sin cadena de construcción. HTML, CSS y JavaScript a secas.

```bash
git clone https://github.com/applibre/pokemon-libre.git
cd pokemon-libre
python -m http.server 8000
```

Las pruebas corren sobre el catálogo de verdad, así que se enteran si se rompe al regenerarlo:

```bash
node --test tests/dominio.test.js
```

| Fichero | Qué hace |
|---|---|
| `js/dominio.js` | Todo el cálculo, en funciones puras: progreso, filtros, búsqueda, lista de faltantes |
| `js/almacen.js` | Guardado local, migraciones, copia diaria, rescate si los datos se corrompen |
| `js/estado.js` | Un solo sitio donde cambian los datos, con aviso a las vistas |
| `js/vistas/` | Una pantalla por fichero |
| `scripts/` | El generador del catálogo |
| `tests/` | 41 pruebas |

Licencia MIT: cópialo, cámbiale los Pokémon, publícalo.

---

Proyecto de aficionado de **[applibre](https://github.com/applibre)**. Sin relación con Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Las imágenes de las cartas son propiedad de sus autores y se muestran únicamente para llevar el control de una colección personal.
