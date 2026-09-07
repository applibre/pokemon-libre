# -*- coding: utf-8 -*-
"""
Pokémon Libre · verificar los enlaces directos a las tiendas

Abre de verdad la página de cada carta en TCG Collector y lee su título,
que tiene la forma «Gengar (Fossil 5/62) (International TCG) – TCG
Collector»: el nombre debe ser el de la carta y el número, el suyo (no
vale que aparezca en el total: 17/25 no es la carta 25). Para TCGplayer
usa el punto de datos de su propia web, porque la página se pinta con
JavaScript y el HTML inicial no dice nada.

    python scripts/verificar-enlaces.py            todas
    python scripts/verificar-enlaces.py --muestra  60 al azar

Escribe scripts/.cache/verificacion-enlaces.json con el detalle y
termina con código 1 si algún enlace no confirma.
"""

import html
import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}
MUESTRA = '--muestra' in sys.argv


def plano(t):
    t = str(t or '').replace('&', ' and ').replace('☆', ' star ').replace('★', ' star ')
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', t.replace("'", '').replace('_', ''))


def mismo_numero(a, b):
    """'005' y '5', 'H09' y 'h9', 'SM108' y 'sm108' son el mismo número."""
    norm = lambda n: re.sub(r'^([a-z]*)0+(?=\d)', r'\1', str(n).lower().strip())
    return norm(a) == norm(b)


def get(u, timeout=40):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={**UA, 'Accept': '*/*'}), timeout=timeout)
    return r.read().decode('utf-8', 'ignore')


def partir_titulo(titulo):
    """'Gengar (Fossil 5/62) (International TCG) – TCG Collector'
       -> ('Gengar', 'Fossil', '5', '62'). Devuelve None si no tiene esa forma."""
    t = html.unescape(titulo).strip()
    t = re.sub(r'\s*\(International TCG\).*$', '', t)
    m = re.match(r'^(.*?) \((.*?)\s+(?:No\.\s*)?([A-Za-z0-9]+)(?:/([A-Za-z0-9]+))?\)$', t)
    return m.groups() if m else None


def tcgcollector(c, manual, sets):
    u = f"https://www.tcgcollector.com/cards/{c['tc_id']}/{c['tc_slug']}"
    try:
        h = get(u)
        t = re.search(r'<title>([^<]*)</title>', h)
        titulo = html.unescape(t.group(1) if t else '').strip()
        partes = partir_titulo(titulo)
        if not partes:
            return {'id': c['id'], 'tienda': 'tcgcollector', 'url': u, 'titulo': titulo[:90], 'ok': False,
                    'motivo': 'título con otra forma'}
        nombre, conjunto, num, tot = partes
        esperado = manual.get(c['id'], {}).get('num', c['num'])
        ok_num = mismo_numero(num, esperado)
        tot_set = str((sets.get(c['s']) or {}).get('tot') or '')
        # el total identifica la colección y, con el número, la carta: dentro
        # de un set no hay dos cartas con el mismo número (comprobado)
        mismo_tot = bool(tot and tot_set) and mismo_numero(re.sub(r'^[A-Za-z]+', '', tot) or tot, tot_set)
        # con número y total confirmados, o en las enlazadas a mano, basta con
        # que el nombre empiece igual: allí escriben «Charizard G LV.X» donde
        # TCGdex pone «Charizard G»
        holgado = (ok_num and mismo_tot) or c['id'] in manual
        ok_nombre = plano(nombre) == plano(c['n']) or (holgado and plano(nombre).startswith(plano(c['n'])))
        # el total de la colección identifica la colección: 5/62 es Fossil y
        # 5/64 es Jungle. Solo se salta en las que se enlazaron a mano, que
        # apuntan aposta a otra edición de la misma carta.
        # La colección se confirma por su total (5/62 es Fossil) o por su
        # nombre. Las subcolecciones llevan total propio —RC3/RC32 dentro de
        # Generations—, así que sin el nombre saldrían por falsas.
        ok_set = ((c['id'] in manual) or not (tot and tot_set) or mismo_tot
                  or mismo_set((sets.get(c['s']) or {}).get('n', ''), conjunto))
        fallo = '' if (ok_nombre and ok_num and ok_set) else (
            'nombre' if not ok_nombre else ('número' if not ok_num else 'colección'))
        return {'id': c['id'], 'tienda': 'tcgcollector', 'url': u, 'titulo': titulo[:90],
                'ok': not fallo, 'motivo': fallo}
    except Exception as e:
        return {'id': c['id'], 'tienda': 'tcgcollector', 'url': u, 'titulo': f'ERROR {getattr(e, "code", e)}',
                'ok': False, 'motivo': 'red'}


# Palabras que aparecen en media docena de colecciones y no distinguen
# ninguna. «ex» tampoco: la mitad de los sets de 2003-2007 empiezan por EX.
RUIDO_SET = {'the', 'and', 'of', 'black', 'star', 'promo', 'promos', 'card', 'cards',
             'collection', 'pokemon', 'tcg', 'set', 'series', 'edition', 'ex', 'gx', 'lv'}
ALIAS = {
    'Wizards Black Star Promos': 'WoTC Promo',
    'Nintendo Black Star Promos': 'Nintendo Promo',
    'DP Black Star Promos': 'Diamond and Pearl Promos',
    'BW Black Star Promos': 'Black and White Promos',
    'XY Black Star Promos': 'XY Promos',
    'SVP Black Star Promos': 'SV Scarlet Violet Promo Cards',
    'MEP Black Star Promos': 'ME Mega Evolution Promo',
}


def tokens_set(nombre):
    t = str(nombre or '').replace('&', ' and ')
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return {x for x in re.split(r'[^a-z0-9]+', t) if len(x) > 1 and x not in RUIDO_SET}


def mismo_set(nuestro, suyo):
    """«Team Up» y «SM09: Team Up» son la misma; «My First Battle» y
       «Pokemon GO», no. Con alias para las promos, que cada casa nombra
       a su manera."""
    if not nuestro or not suyo:
        return False
    a = ALIAS.get(nuestro)
    if a and tokens_set(a) & tokens_set(suyo):
        return True
    return bool(tokens_set(nuestro) & tokens_set(suyo))


def tcgplayer(c, sets, manual_tp):
    """Su ficha de producto da nombre, número y fecha. Se exigen los tres:
       el nombre de la carta, su mismo número y un año que cuadre con el de
       la colección (±1: TCGplayer fecha algunas promos por el producto)."""
    u = f"https://mp-search-api.tcgplayer.com/v1/product/{c['tp_id']}/details"
    try:
        j = json.loads(get(u))
        ca = j.get('customAttributes') or {}
        nombre = str(j.get('productName') or '')
        num = str(ca.get('number') or '')
        anio = str(ca.get('releaseDate') or j.get('releaseDate') or '')[:4]
        base = plano(c['n'])
        pn = plano(nombre)
        ok_nombre = pn.startswith(base)
        ok_num = mismo_numero(num.split('/')[0], c['num']) if num else False
        # Las localizadas a mano se comprueban contra lo que vi al elegirlas:
        # nombre y colección exactos. Su número allí no existe o es otro.
        esperado = manual_tp.get(c['id'])
        if esperado:
            igual = (nombre.strip() == esperado['nombre'] and str(j.get('setName') or '').strip() == esperado['set'])
            return {'id': c['id'], 'tienda': 'tcgplayer', 'url': f"https://www.tcgplayer.com/product/{c['tp_id']}",
                    'titulo': f"{nombre} · {j.get('setName')} · a mano"[:90],
                    'ok': igual, 'motivo': '' if igual else 'cambió la ficha'}

        nuestro_set = (sets.get(c['s']) or {})
        anio_set = str(nuestro_set.get('rel') or '')[:4]
        ok_anio = not (anio and anio_set) or abs(int(anio) - int(anio_set)) <= 1
        ok_set = mismo_set(nuestro_set.get('n', ''), str(j.get('setName') or ''))
        fallo = '' if (ok_nombre and ok_num and ok_set and ok_anio) else (
            'nombre' if not ok_nombre else ('número' if not ok_num else ('colección' if not ok_set else 'año')))
        return {'id': c['id'], 'tienda': 'tcgplayer', 'url': f"https://www.tcgplayer.com/product/{c['tp_id']}",
                'titulo': f"{nombre} · {j.get('setName')} · {num} · {anio}"[:90],
                'ok': not fallo, 'motivo': fallo}
    except Exception as e:
        return {'id': c['id'], 'tienda': 'tcgplayer', 'url': u, 'titulo': f'ERROR {getattr(e, "code", e)}',
                'ok': False, 'motivo': 'red'}


def main():
    cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
    ruta_manual = os.path.join(AQUI, 'tcgcollector-manual.json')
    manual = json.load(open(ruta_manual, encoding='utf-8')) if os.path.exists(ruta_manual) else {}
    ruta_tp = os.path.join(AQUI, 'tcgplayer-manual.json')
    manual_tp = json.load(open(ruta_tp, encoding='utf-8')) if os.path.exists(ruta_tp) else {}
    con_tc = [c for c in cat['cartas'] if c.get('tc_id')]
    con_tp = [c for c in cat['cartas'] if c.get('tp_id')]
    if MUESTRA:
        random.seed(11)
        con_tc = random.sample(con_tc, min(60, len(con_tc)))
        con_tp = random.sample(con_tp, min(60, len(con_tp)))

    t0 = time.time()
    with ThreadPoolExecutor(4) as ex:
        res_tc = list(ex.map(lambda c: tcgcollector(c, manual, cat['sets']), con_tc))
    with ThreadPoolExecutor(6) as ex:
        res_tp = list(ex.map(lambda c: tcgplayer(c, cat['sets'], manual_tp), con_tp))

    # reintento único de los errores de red
    for lista, fn in ((res_tc, lambda c: tcgcollector(c, manual, cat['sets'])), (res_tp, lambda c: tcgplayer(c, cat['sets'], manual_tp))):
        for i, r in enumerate(lista):
            if r['motivo'] == 'red':
                time.sleep(2)
                c = next(x for x in cat['cartas'] if x['id'] == r['id'])
                lista[i] = fn(c)

    malas_tc = [r for r in res_tc if not r['ok']]
    malas_tp = [r for r in res_tp if not r['ok']]
    print(f"TCG Collector: {len(res_tc) - len(malas_tc)} de {len(res_tc)} páginas confirman nombre y número")
    for r in malas_tc[:40]:
        print('   ?', r['id'], '|', r['motivo'], '|', r['titulo'])
    print(f"TCGplayer:     {len(res_tp) - len(malas_tp)} de {len(res_tp)} confirman nombre, número y año")
    for r in malas_tp[:40]:
        print('   ?', r['id'], '|', r['motivo'], '|', r['titulo'])
    print(f"({time.time() - t0:.0f}s)")

    os.makedirs(os.path.join(AQUI, '.cache'), exist_ok=True)
    json.dump({'tcgcollector': res_tc, 'tcgplayer': res_tp},
              open(os.path.join(AQUI, '.cache', 'verificacion-enlaces.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    sys.exit(1 if (malas_tc or malas_tp) else 0)


if __name__ == '__main__':
    main()
