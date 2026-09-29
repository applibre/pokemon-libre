# -*- coding: utf-8 -*-
"""
Pokémon Libre · las cartas japonesas

TCGdex tiene el japonés a medias (da 20 Gengar cuando hay 101), así que
se traen de TCG Collector, que sí tiene la base japonesa completa. Su
buscador no deja pasar de la primera página, pero sí deja entrar a cada
expansión, que además es como las queremos: divididas y en orden.

Tres pasos, cada uno se guarda y se puede repetir sin empezar de cero:

    python scripts/japonesas.py sets     lista las expansiones japonesas
    python scripts/japonesas.py cartas   recorre cada expansión
    python scripts/japonesas.py fichas   abre cada carta: nombre e imagen

Escribe scripts/japonesas-sets.json y scripts/japonesas.json
"""

import html
import json
import os
import re
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SETS = os.path.join(AQUI, 'japonesas-sets.json')
CARTAS = os.path.join(AQUI, 'japonesas.json')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}

# Los 17 de siempre, como aparecen en las direcciones de TCG Collector.
NUESTROS = ['pikachu', 'raichu', 'pichu', 'gengar', 'gastly', 'haunter', 'snorlax', 'munchlax',
            'charmander', 'charmeleon', 'charizard', 'bulbasaur', 'ivysaur', 'venusaur',
            'squirtle', 'wartortle', 'blastoise']


def get(u, intentos=3):
    for i in range(1, intentos + 1):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf-8', 'ignore')
        except Exception:
            if i == intentos:
                raise
            time.sleep(2 * i)


def limpio(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip()


def paso_sets():
    """Las expansiones japonesas, en el orden en que las enseña la web (de
       la más nueva a la más vieja), con su nombre, su código y su era."""
    h = get('https://www.tcgcollector.com/sets/jp')

    # dónde empieza cada era, para saber a cuál pertenece cada expansión
    eras = [(m.start(), limpio(m.group(1)))
            for m in re.finditer(r'set-search-result-group-title[^>]*>(.{0,160}?)</', h, re.S)]

    salida, vistos = [], set()
    for m in re.finditer(r'href="/sets/(\d+)/([a-z0-9-]+)\?[^"]*"\s*title="([^"]*)"', h):
        sid = m.group(1)
        if sid in vistos:
            continue
        vistos.add(sid)
        cod = re.search(r'set-logo-grid-item-code"[^>]*>(.{0,40}?)</span>', h[m.end():m.end() + 400], re.S)
        era = ''
        for pos, nombre in eras:
            if pos < m.start():
                era = nombre
        salida.append({'tc': sid, 'slug': m.group(2), 'n': html.unescape(m.group(3)).strip(),
                       'cod': limpio(cod.group(1)) if cod else '', 'era': era})

    json.dump(salida, open(SETS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sin_codigo = sum(1 for s in salida if not s['cod'])
    print(f'Expansiones japonesas: {len(salida)} · sin código: {sin_codigo}')
    for s in salida[:6]:
        print(f"   {s['cod']:<8} {s['n'][:42]:<42} {s['era']}")


def paso_cartas():
    """Recorre cada expansión y se queda con las cartas cuyo nombre lleva
       uno de nuestros Pokémon. Se acepta de sobra: la comprobación seria
       viene después, leyendo el título de cada carta."""
    sets = json.load(open(SETS, encoding='utf-8'))
    previo = json.load(open(CARTAS, encoding='utf-8')) if os.path.exists(CARTAS) else {}
    hechos = {c['set_tc'] for c in previo.values()} if previo else set()
    salida = dict(previo)
    pendientes = [s for s in sets if s['tc'] not in hechos]
    print(f'Expansiones: {len(sets)} · ya recorridas: {len(hechos)} · pendientes: {len(pendientes)}\n', flush=True)

    for i, s in enumerate(pendientes, 1):
        try:
            h = get(f"https://www.tcgcollector.com/sets/{s['tc']}/{s['slug']}")
        except Exception as e:
            print(f"  ! {s['slug']}: {e}", flush=True)
            continue
        vistos = set()
        nuevas = 0
        for m in re.finditer(r'href="/cards/(\d+)/([^"?]+)"', h):
            cid, slug = m.group(1), m.group(2)
            if cid in vistos:
                continue
            vistos.add(cid)
            if not any(slug.startswith(n + '-') or ('-' + n + '-') in slug for n in NUESTROS):
                continue
            if cid in salida:
                continue
            salida[cid] = {'tc': int(cid), 'slug': slug, 'set_tc': s['tc'], 'set_n': s['n'], 'set_cod': s['cod']}
            nuevas += 1
        if nuevas:
            print(f"  {i}/{len(pendientes)} {s['cod']:<8} {s['n'][:34]:<34} +{nuevas}", flush=True)
        # la expansión se marca como recorrida aunque no tuviera ninguna
        salida.setdefault('_' + s['tc'], {'tc': 0, 'slug': '', 'set_tc': s['tc'], 'set_n': s['n'], 'set_cod': s['cod']})
        if i % 20 == 0:
            json.dump(salida, open(CARTAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        time.sleep(0.45)

    json.dump(salida, open(CARTAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    reales = [c for k, c in salida.items() if not k.startswith('_')]
    print(f'\nCartas candidatas de nuestros 17: {len(reales)}')


def paso_fichas():
    """Abre la página de cada carta: nombre, número y la imagen. El título
       manda: «Gengar (Nullifying Zero 049/080) (Japanese TCG)»."""
    salida = json.load(open(CARTAS, encoding='utf-8'))
    pendientes = [c for k, c in salida.items() if not k.startswith('_') and not c.get('n')]
    print(f'Fichas por leer: {len(pendientes)}\n', flush=True)
    hechas = descartadas = 0
    for i, c in enumerate(pendientes, 1):
        try:
            h = get(f"https://www.tcgcollector.com/cards/{c['tc']}/{c['slug']}")
        except Exception as e:
            print(f"  ! {c['slug']}: {e}", flush=True)
            continue
        t = html.unescape(re.search(r'<title>([^<]*)</title>', h).group(1))
        m = re.match(r'^(.*?) \((.*?)\s+(?:No\.\s*)?([A-Za-z0-9/]+)\)', re.sub(r'\s*\(Japanese TCG\).*$', '', t))
        nombre = m.group(1).strip() if m else ''
        # solo se queda si el nombre lleva de verdad uno de los nuestros
        plano = re.sub(r'[^a-z]', '', nombre.lower())
        if not any(n in plano for n in NUESTROS):
            descartadas += 1
            c['fuera'] = True
            continue
        img = re.search(r'og:image" content="([^"]*)"', h)
        c['n'] = nombre
        c['num'] = m.group(3) if m else ''
        c['set_titulo'] = m.group(2) if m else c.get('set_n', '')
        c['img'] = img.group(1) if img else None
        hechas += 1
        if i % 25 == 0:
            json.dump(salida, open(CARTAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f'  {i}/{len(pendientes)} · leídas {hechas} · descartadas {descartadas}', flush=True)
        time.sleep(0.4)
    json.dump(salida, open(CARTAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\nFichas leídas: {hechas} · descartadas por no ser nuestras: {descartadas}')


def paso_detalles():
    """Segunda vuelta: la ficha japonesa trae rareza, ilustrador, puntos
       de salud y etapa, igual que la inglesa. Sin esto la ficha de una
       carta japonesa queda casi vacía y no cuenta nada."""
    salida = json.load(open(CARTAS, encoding='utf-8'))
    pendientes = [c for k, c in salida.items()
                  if not k.startswith('_') and c.get('n') and not c.get('fuera') and not c.get('visto')]
    print('Fichas por completar: ' + str(len(pendientes)), flush=True)

    def tras(texto, etiqueta):
        m = re.search(re.escape(etiqueta) + r'[\s|]+([^|]{1,60})', texto)
        return m.group(1).strip() if m else ''

    hechas = 0
    for i, c in enumerate(pendientes, 1):
        try:
            h = get(f"https://www.tcgcollector.com/cards/{c['tc']}/{c['slug']}")
        except Exception as e:
            print(f"  ! {c['slug']}: {e}", flush=True)
            continue
        texto = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' | ', h)))
        c['r'] = tras(texto, 'Rarity')
        c['ill'] = tras(texto, 'Illustrators')
        ps = tras(texto, 'HP')
        if ps.isdigit():
            c['ps'] = int(ps)
        m = re.search(r'Pok.mon[\s|]+(Basic|Stage 1|Stage 2|VMAX|VSTAR)', texto)
        if m:
            c['etapa'] = m.group(1)
        m = re.search(r'Evolves from[\s|]+([^|]{1,30})', texto)
        if m:
            c['de'] = m.group(1).strip()
        c['visto'] = True
        hechas += 1
        if i % 25 == 0:
            json.dump(salida, open(CARTAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f'  {i}/{len(pendientes)} · completadas {hechas}', flush=True)
        time.sleep(0.35)

    json.dump(salida, open(CARTAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('')
    print('Fichas completadas: ' + str(hechas))


if __name__ == '__main__':
    paso = sys.argv[1] if len(sys.argv) > 1 else 'sets'
    {'sets': paso_sets, 'cartas': paso_cartas, 'fichas': paso_fichas, 'detalles': paso_detalles}[paso]()
