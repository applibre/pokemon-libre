# -*- coding: utf-8 -*-
"""
Pokémon Libre · localizar en TCGplayer las cartas que TCGdex no trae

TCGdex da el identificador de producto de TCGplayer solo cuando también
trae su precio. Para el resto (promos, kits, cartas recién salidas) se
busca aquí, una vez, con el mismo buscador que usa su web, y se acepta
solo si coinciden el nombre y el número de la carta.

    python scripts/tcgplayer.py            solo las que faltan
    python scripts/tcgplayer.py --todas    rehacer todas

Escribe scripts/tcgplayer.json  { id: {"tp": 106521, "nombre": "..."} }
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SALIDA = os.path.join(AQUI, 'tcgplayer.json')
MANUAL = os.path.join(AQUI, 'tcgplayer-manual.json')   # las que su buscador no da: comprobadas a mano
TODAS = '--todas' in sys.argv
CAB = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://www.tcgplayer.com',
    'Referer': 'https://www.tcgplayer.com/',
}


def plano(t):
    t = str(t or '').replace('&', ' and ').replace('☆', ' star ').replace('★', ' star ')
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', t.replace("'", '').replace('_', ''))


def numero(n):
    """'05/62' → '5' ; 'SM108' → 'sm108' ; 'H09' → 'h9'."""
    n = str(n or '').strip().lower().split('/')[0]
    return re.sub(r'^([a-z]*)0+(?=\d)', r'\1', n)


def buscar(texto, n=12):
    cuerpo = {
        'algorithm': 'sales_synonym_v2', 'from': 0, 'size': n,
        'filters': {'term': {'productLineName': ['pokemon']}, 'range': {}, 'match': {}},
        'context': {'cart': {}, 'shippingCountry': 'US', 'userProfile': {}},
        'settings': {'useFuzzySearch': True, 'didYouMean': {}}, 'sort': {},
    }
    u = 'https://mp-search-api.tcgplayer.com/v1/search/request?q=' + urllib.parse.quote(texto) + '&isList=false'
    for i in range(1, 4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, data=json.dumps(cuerpo).encode(), headers=CAB), timeout=40)
            j = json.loads(r.read())
            res = (j.get('results') or [{}])[0].get('results') or []
            return [{'id': int(x['productId']), 'n': x.get('productName') or '',
                     'set': x.get('setName') or '', 'num': (x.get('customAttributes') or {}).get('number') or ''}
                    for x in res if x.get('productId')]
        except Exception:
            if i == 3:
                return []
            time.sleep(2 * i)
    return []


# Justo detrás del nombre, estas palabras significan OTRA carta:
# «Pikachu» y «Pikachu VMAX» no son la misma, ni «Gengar» y «Gengar ex».
SUFIJOS = {'v', 'vmax', 'vstar', 'gx', 'ex', 'break', 'prime', 'legend', 'lv', 'star', 'tag'}


def piezas(t):
    """'Alolan Raichu (#30 Holofoil)' → ['alolan','raichu','30','holofoil']"""
    t = str(t or '').replace('&', ' and ').replace('☆', ' star ').replace('★', ' star ')
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return [x for x in re.split(r'[^a-z0-9]+', t.replace("'", '')) if x]


def encaja(r, carta):
    """El nombre del producto empieza por el de la carta —TCGplayer le añade
       cosas: «Gengar (5)», «Alolan Raichu (#30 Holofoil)»— sin que lo que
       sigue lo convierta en otra carta, y el número es el mismo. Sin número
       no se acepta: sería adivinar."""
    nombre = piezas(carta['n'])
    pn = piezas(r['n'])
    if not nombre or pn[:len(nombre)] != nombre:
        return False
    resto = pn[len(nombre):]
    if resto and resto[0] in SUFIJOS:
        return False
    return bool(r['num']) and numero(r['num']) == numero(carta['num'])


# Palabras que aparecen en media docena de colecciones y no distinguen
# ninguna. «ex» tampoco: la mitad de los sets de 2003-2007 empiezan por EX.
RUIDO_SET = {'the', 'and', 'of', 'black', 'star', 'promo', 'promos', 'card', 'cards',
             'collection', 'pokemon', 'tcg', 'set', 'series', 'edition', 'ex', 'gx', 'lv'}


def tokens_set(nombre):
    return {t for t in piezas(nombre) if len(t) > 1 and t not in RUIDO_SET}


def mismo_set(nuestro, suyo):
    """¿Hablan de la misma colección? Con el alias si lo hay, y si no, con
       que compartan una palabra que signifique algo: «Team Up» y «SM09:
       Team Up» sí; «My First Battle» y «Pokemon GO» no."""
    if not nuestro or not suyo:
        return False
    a = ALIAS.get(nuestro)
    if a and tokens_set(a) & tokens_set(suyo):
        return True
    return bool(tokens_set(nuestro) & tokens_set(suyo))


def detalles(pid):
    u = f'https://mp-search-api.tcgplayer.com/v1/product/{pid}/details'
    for i in range(1, 3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': CAB['User-Agent']}), timeout=30)
            return json.loads(r.read())
        except Exception:
            time.sleep(1.5 * i)
    return None


def confirma(pid, carta, conjunto):
    """Antes de aceptar un identificador se abre su ficha y se comprueban
       nombre, número y año. Sin esto se cuelan cartas de otra colección con
       el mismo número: un Pikachu 26/83 de Generations no es la promo 26 de
       Wizards, y las dos se llaman «Pikachu»."""
    j = detalles(pid)
    if not j:
        return False
    ca = j.get('customAttributes') or {}
    if not encaja({'n': j.get('productName') or '', 'set': j.get('setName') or '',
                   'num': str(ca.get('number') or '')}, carta):
        return False
    if not mismo_set((conjunto or {}).get('n', ''), j.get('setName') or ''):
        return False
    anio = str(ca.get('releaseDate') or '')[:4]
    anio_set = str((conjunto or {}).get('rel') or '')[:4]
    if anio and anio_set and abs(int(anio) - int(anio_set)) > 1:
        return False
    return True


# TCGplayer llama a varias colecciones de otra manera. Sin esto su buscador
# no encuentra las promos antiguas, que son justo las que TCGdex no trae.
ALIAS = {
    'Wizards Black Star Promos': 'WoTC Promo',
    'Nintendo Black Star Promos': 'Nintendo Promo',
    'DP Black Star Promos': 'Diamond and Pearl Promos',
    'BW Black Star Promos': 'Black and White Promos',
    'XY Black Star Promos': 'XY Promos',
    'XY Black Star Promos': 'XY Black Star Promos',
    'SM Black Star Promos': 'SM Black Star Promos',
    'SWSH Black Star Promos': 'SWSH Black Star Promos',
    'SVP Black Star Promos': 'SV Scarlet Violet Promo Cards',
    'MEP Black Star Promos': 'ME Mega Evolution Promo',
    'Celebrations Classic Collection': 'Celebrations Classic Collection',
}


def main():
    cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
    previo = {} if TODAS or not os.path.exists(SALIDA) else json.load(open(SALIDA, encoding='utf-8'))
    manual = json.load(open(MANUAL, encoding='utf-8')) if os.path.exists(MANUAL) else {}
    salida = dict(previo)
    salida.update({k: {'tp': v['tp'], 'nombre': v['nombre'], 'set': v['set'], 'num': ''}
                   for k, v in manual.items() if not k.startswith('_')})
    faltan = [c for c in cat['cartas'] if not c.get('tp_id') and c['id'] not in salida]
    print(f"Sin identificador de TCGplayer: {len(faltan)}\n", flush=True)

    halladas, fallidas = 0, []
    for i, c in enumerate(faltan, 1):
        conjunto = cat['sets'].get(c['s']) or {}
        set_nombre = conjunto.get('n', '')
        alias = ALIAS.get(set_nombre, '')
        consultas = [f"{c['n']} {set_nombre}".strip(), f"{c['n']} {alias}".strip() if alias else '',
                     f"{c['n']} {c['num']}".strip(), c['n']]
        vistos, cand = set(), []
        for q in [x for x in consultas if x]:
            for r in buscar(q):
                if r['id'] not in vistos and encaja(r, c):
                    vistos.add(r['id'])
                    cand.append(r)
            time.sleep(0.25)

        # Primero la impresión base: entre «Pikachu - 027» y «Pikachu - 027
        # (Pokemon Center Exclusive)» vale la primera, que es la carta suelta.
        # Y siempre se abre su ficha antes de aceptarla.
        cand.sort(key=lambda r: (len(piezas(r['n'])), r['id']))
        elegido = None
        for r in cand:
            if confirma(r['id'], c, conjunto):
                elegido = r
                break

        if elegido:
            salida[c['id']] = {'tp': elegido['id'], 'nombre': elegido['n'], 'set': elegido['set'], 'num': elegido['num']}
            halladas += 1
        else:
            fallidas.append(c)

        if i % 20 == 0 or i == len(faltan):
            print(f"  {i}/{len(faltan)} · localizadas {halladas}", flush=True)
            json.dump(salida, open(SALIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        time.sleep(0.3)

    json.dump(salida, open(SALIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n' + '─' * 52)
    print(f"Localizadas a mayores en TCGplayer: {len(salida)}")
    if fallidas:
        print(f"\nSiguen sin página propia ({len(fallidas)}):")
        for c in fallidas:
            print(f"  · {c['id']:<16} {c['n']:<26} {cat['sets'].get(c['s'], {}).get('n', '')} {c['num']}")


if __name__ == '__main__':
    main()
