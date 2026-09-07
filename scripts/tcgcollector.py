# -*- coding: utf-8 -*-
"""
Pokémon Libre · localizar cada carta en TCG Collector

Su buscador solo admite texto libre, pero cada resultado lleva en la
dirección el nombre, la colección y el número con el total
(/cards/610/gengar-fossil-5-62). Con eso se localiza la página de cada
carta UNA vez, aquí, y la app enlaza directo.

Regla: se acepta solo si la dirección empieza por el nombre de la carta
y termina en su número (con o sin el total de la colección). Si hay más
de un candidato y la colección no lo desempata, no se elige ninguno.

(En Python y no en Node: el servidor devuelve 403 a Node por su huella TLS.)

    python scripts/tcgcollector.py            solo las que faltan
    python scripts/tcgcollector.py --todas    rehacer todas
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
SALIDA = os.path.join(AQUI, 'tcgcollector.json')
MANUAL = os.path.join(AQUI, 'tcgcollector-manual.json')   # las que su buscador no da: localizadas a mano y comprobadas a ojo
TODAS = '--todas' in sys.argv
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}


def plano(t):
    t = str(t or '').replace('&', ' and ').replace('☆', ' star ').replace('★', ' star ')
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    t = t.replace("'", '').replace('_', '')      # Sabrina's -> sabrinas ; ______'s Pikachu -> s pikachu
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', t)).strip('-')


def buscar(texto):
    u = 'https://www.tcgcollector.com/cards/intl?cardSearch=' + urllib.parse.quote(texto)
    for i in range(1, 4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40)
            html = r.read().decode('utf-8', 'ignore')
            vistos, out = set(), []
            for m in re.finditer(r'href="/cards/(\d+)/([^"]+)"', html):
                cid, slug = int(m.group(1)), m.group(2)
                if cid not in vistos:
                    vistos.add(cid)
                    out.append((cid, slug))
            return out
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(5 * i)
                continue
            if i == 3:
                raise
        except Exception:
            if i == 3:
                raise
        time.sleep(1.5 * i)
    return []


# Tokens que, justo detrás del nombre, indican OTRA carta (Pikachu V no es
# Pikachu). «ex» no vale aquí: las colecciones de 2003-2007 empiezan por EX.
SUFIJOS = {'v', 'vmax', 'vstar', 'gx', 'break', 'prime', 'legend', 'lv', 'tag'}


def variantes_num(num):
    num = str(num).lower()
    return {v for v in (num, re.sub(r'^0+(?=\d)', '', num), num.zfill(3) if num.isdigit() else num,
                        re.sub(r'^([a-z]+)0+(?=\d)', r'\1', num)) if v}


def variantes_tot(tot, num):
    """El total de una subcolección lleva su letra: TG03 de 30 se escribe
       «tg03-tg30», y SV6 de 94, «sv6-sv94»."""
    tot = str(tot or '').lower()
    if not tot:
        return set()
    base = {tot, tot.zfill(3), re.sub(r'^0+(?=\d)', '', tot)}
    pre = re.match(r'^([a-z]+)', str(num).lower())
    if pre:
        base |= {pre.group(1) + t for t in list(base)}
    return {v for v in base if v}


def encaja(slug, carta, conjunto):
    """0 = no es esta carta; 1 = nombre y número encajan; 2 = además cuadra
       el total de la colección (o no hay total, en las promos), que junto al
       número identifica la carta sin lugar a dudas."""
    s = slug.lower()
    nombre = plano(carta['n'])
    if not nombre or not s.startswith(nombre + '-'):
        return 0
    nums = variantes_num(carta['num'])
    tots = variantes_tot((conjunto or {}).get('tot'), carta['num'])

    # número Y total: es esa carta y no otra, aunque allí la llamen de otra
    # manera («Raichu» y «Raichu LV.X» son la 99/100 de Stormfront).
    for n in nums:
        for t in tots:
            if re.search(r'-' + re.escape(n) + '-' + re.escape(t) + '$', s):
                return 2

    # sin el total, lo que siga al nombre no puede convertirla en otra carta
    resto = s[len(nombre) + 1:].split('-')
    if resto and resto[0] in SUFIJOS:
        return 0

    if not tots:      # promos y mazos: no hay total que comprobar
        for n in nums:
            mm = re.search(r'-([a-z0-9]+)-(no-)?' + re.escape(n) + '$', s)
            if mm and not re.fullmatch(r'[a-z]{0,2}[0-9]+[a-z]?', mm.group(1)):
                return 2
    return 1 if any(re.search(r'-(no-)?' + re.escape(n) + r'(-[a-z0-9]+)?$', s) for n in nums) else 0


def tokens_set(nombre_set):
    RUIDO = {'the', 'and', 'of', 'black', 'star', 'promos', 'promo', 'series', 'set', 'kit', 'trainer', 'collection'}
    return [t for t in plano(nombre_set).split('-') if len(t) > 2 and t not in RUIDO]


def main():
    cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
    previo = {} if TODAS or not os.path.exists(SALIDA) else json.load(open(SALIDA, encoding='utf-8'))
    manual = {} if not os.path.exists(MANUAL) else json.load(open(MANUAL, encoding='utf-8'))
    salida = dict(previo)
    salida.update({k: {'tc': v['tc'], 'slug': v['slug']} for k, v in manual.items() if not k.startswith('_')})
    pendientes = [c for c in cat['cartas'] if c['id'] not in salida]
    print(f"Cartas: {len(cat['cartas'])} · ya localizadas: {len(previo)} · a buscar: {len(pendientes)}\n", flush=True)

    halladas = 0
    fallidas = []
    for i, c in enumerate(pendientes, 1):
        conjunto = cat['sets'].get(c['s'])
        set_nombre = conjunto['n'] if conjunto else ''
        # Se prueba con el nombre tal cual —su buscador entiende «Sabrina's
        # Gengar» y «Celebi & Venusaur GX»— y también en llano, porque la δ
        # y la ☆ de las cartas antiguas allí no se escriben.
        crudo = c['n'].strip()
        llano = plano(c['n']).replace('-', ' ')
        consultas = []
        for nombre in ([crudo, llano] if llano != crudo.lower() else [crudo]):
            consultas += [f"{nombre} {set_nombre}".strip(), f"{nombre} {c['num']}".strip(),
                          f"{nombre} {' '.join(tokens_set(set_nombre)[:2])}".strip(), nombre]
        consultas = list(dict.fromkeys([x for x in consultas if x]))
        elegido = None
        for q in consultas:
            try:
                res = buscar(q)
            except Exception:
                res = []
            puntos = {r: encaja(r[1], c, conjunto) for r in res}
            toks = tokens_set(set_nombre)
            exactas = [r for r in res if puntos[r] == 2]
            laxas = [r for r in res if puntos[r] == 1 and toks and all(t in r[1] for t in toks)]
            cand = exactas or laxas
            if len(cand) == 1:
                elegido = cand[0]
                break
            if len(cand) > 1 and conjunto:
                con_set = [r for r in cand if plano(conjunto['n']) in r[1]]
                if len(con_set) != 1:
                    con_set = [r for r in cand if toks and all(t in r[1] for t in toks)]
                if len(con_set) == 1:
                    elegido = con_set[0]
                    break
            time.sleep(0.35)

        if elegido:
            salida[c['id']] = {'tc': elegido[0], 'slug': elegido[1]}
            halladas += 1
        else:
            fallidas.append(c)

        if i % 25 == 0 or i == len(pendientes):
            print(f"  {i}/{len(pendientes)} · localizadas {halladas}", flush=True)
            json.dump(salida, open(SALIDA, 'w', encoding='utf-8'), indent=1)
        time.sleep(0.4)

    json.dump(salida, open(SALIDA, 'w', encoding='utf-8'), indent=1)
    print('\n' + '─' * 52)
    print(f"Localizadas en TCG Collector: {len(salida)} de {len(cat['cartas'])}")
    if fallidas:
        print(f"\nSin localizar ({len(fallidas)}):")
        for c in fallidas:
            print(f"  · {c['id']:<16} {c['n']:<26} {cat['sets'].get(c['s'], {}).get('n', '')} {c['num']}")


if __name__ == '__main__':
    main()
