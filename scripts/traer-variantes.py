# -*- coding: utf-8 -*-
"""
Pokémon Libre · variantes de cada carta (sellos, holos especiales, exclusivas…)

Una VARIANTE es una impresión física distinta de la MISMA carta: la Pikachu 051/162
normal, la de Pokémon Day 2026 con sello, la Cosmos Holo… TCGdex solo conoce Normal,
Holo, Reverse y 1.ª edición. TCGplayer lista cada impresión como producto aparte
(«Pikachu (Pokemon Day 2026)»), y de ahí salen las demás.

    python scripts/traer-variantes.py

Para cada producto de TCGplayer de tus 17 Pokémon que NO es ya una carta de la app:
  · si lleva un sello/tratamiento entre paréntesis, o viene de un producto de
    reimpresiones (Prize Pack, Jumbo, Shadowless, Battle Academy…), es una variante;
  · se asigna a la carta de la app con el mismo nombre, número y total impreso, y SOLO
    si es una única; si hay dudas va a «revisar» y no se añade.
Escribe scripts/variantes.json: { nv: {clave: nombre}, cartas: {id: [claves]}, revisar: [...] }
que lee scripts/catalogo.mjs (paso 5.8). Las marcas guardadas usan la clave, que no cambia.
"""
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict, Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
GYM = os.path.dirname(RAIZ)
CARPETA = os.path.join(GYM, 'plan-tienda-tcg', 'web')
sys.path.insert(0, os.path.join(CARPETA, 'scripts', 'catalogo'))
import importar as m  # noqa: E402  (pedir() con caché de tcgcsv)

catalogo = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
objetivos = json.load(open(os.path.join(AQUI, 'objetivos.json'), encoding='utf-8'))
sets = catalogo['sets']
RX = re.compile(r'\b(' + '|'.join(p['nombre'] for p in objetivos['principales'] + objetivos['familias']) + r')\b', re.I)


def cl(t):
    return re.sub(r'[^a-z0-9]', '', str(t).lower().replace('é', 'e').replace('δ', 'delta').replace('&', 'and'))


def num(n):
    n = str(n or '').split('/')[0].strip().lower()
    return re.sub(r'^([a-z]*)0+(?=\d)', r'\1', n)


def base(n):
    n = re.sub(r'\s*\[[^\]]*\]', '', n)
    n = re.sub(r'\s*\([^)]*\)', '', n)
    n = re.sub(r'\s+-\s+[A-Za-z]*\d[\w/ -]*$', '', n)
    n = re.sub(r'\s+-\s+[A-Z]{1,5}(-[A-Z]{1,5})?$', '', n)
    n = re.sub(r'\s+-\d+$', '', n)   # «Charizard ex -196»
    n = re.sub(r'\s+-\s+(?:Pikachu|Charizard)\s+\d+$', '', n)   # Battle Academy: «Ampharos - Pikachu 47»
    n = re.sub(r'\s+\d{1,3}/\d{1,3}$', '', n.strip())   # «Gengar 094/165 (Cosmos Holo)»
    return n.strip()


def etiquetas(n):
    return [(a or b).strip() for a, b in re.findall(r'\(([^)]*)\)|\[([^\]]*)\]', n)]


def slug(t):
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


# Etiquetas que NO son una variante: forman parte de la carta (Pikachu δ, Gengar Prime, piezas de una V-UNION…)
NO_VARIANTE = re.compile(
    r'^(delta species|team plasma|prime|form [xy]|top (left|right)|bottom (left|right)|break|\d+|'
    r'english|italian|korean|spanish|japanese|german|french|polish|portuguese|green|mega .*|'
    r'pikachu \d+|#?\d+ .*stamped)$', re.I)
# Productos que son reimpresiones de cartas ya existentes: su etiqueta es el propio producto
GRUPOS = [
    (r'^Base Set \(Shadowless\)$', 'Shadowless'), (r'^Prize Pack', 'Prize Pack'), (r'^Jumbo Cards', 'Jumbo (tamaño gigante)'),
    (r'^Trick or Trade', 'Trick or Trade'), (r'^Countdown Calendar', 'Calendario Countdown'), (r'^Deck Exclusives', 'Exclusiva de mazo'),
    (r'^Blister Exclusives', 'Exclusiva de blíster'), (r'^Burger King', 'Burger King'),
]
GRUPOS_SOLO = [(r'^Battle Academy( \d{4})?$', None)]
ARREGLOS = [(r'^Pokemon\b', 'Pokémon'), (r'\bPokemon\b', 'Pokémon'), (r'^Mirror Holofoil$', 'Mirror Holo'), (r'^Poke Ball', 'Poké Ball')]


def limpia(t):
    t = re.sub(r'^#\d+\s*', '', t).strip()
    for a, b in ARREGLOS:
        t = re.sub(a, b, t)
    return t


def nombre_variante(p):
    """El nombre que verá Arturo, o None si el producto no es una variante."""
    g, n = p['gn'], p['n']
    for rx, _ in GRUPOS_SOLO:
        if re.match(rx, g):
            return 'Battle Academy ' + (re.search(r'\d{4}', g).group(0) if re.search(r'\d{4}', g) else '2020')
    if re.match(r'^World Championship Decks', g):
        y = re.search(r'-\s*(\d{4})\s*\(([^)]*)\)', n)
        return f'Mundial {y.group(1)} · {y.group(2)}' if y else None
    tg = [limpia(t) for t in etiquetas(n)]
    tg = [t for t in tg if t and not NO_VARIANTE.match(t)]
    for rx, etiq in GRUPOS:
        if re.match(rx, g):
            return ' · '.join([etiq] + tg)
    return ' · '.join(dict.fromkeys(tg)) or None


def todos(cat):
    out = []
    for g in m.pedir(f'https://tcgcsv.com/tcgplayer/{cat}/groups', cache=False)['results']:
        for p in (m.pedir(f'https://tcgcsv.com/tcgplayer/{cat}/{g["groupId"]}/products', pausa=0.05) or {}).get('results', []):
            e = {x['name']: x['value'] for x in p.get('extendedData') or []}
            out.append({'gn': g['name'], 'ab': g.get('abbreviation') or '', 'fecha': (g.get('publishedOn') or '')[:10], 'id': p['productId'], 'n': p['name'], 'num': e.get('Number'), 'hp': e.get('HP')})
    return out


nv, cartas, revisar = {}, defaultdict(list), []
# Dos casos con varias cartas base posibles, resueltos mirando la carta (ilustrador, PS, año):
#   187219 Pikachu 012 con el sello del 10.º aniversario = la Nintendo Black Star 012 (np-12, Kouki Saitou), no la de POP 5
#   224679 Pikachu 70/100 con el sello Platinum de Burger King = la de Majestic Dawn (60 PS), no la de Stormfront (70 PS)
A_MANO = {187219: 'np-12', 224679: 'dp5-70'}
# Productos de «Miscellaneous» que son la MISMA carta que otra japonesa que la app ya tiene (no una variante):
#   Charizard 143/S-P (=ja-tp597342), Charizard Meiji 054/ADV-P (=ja-tp613595), Pikachu 11th Movie 003/009 (=ja-32276)
MISMA_CARTA = {282521, 478250, 484830}


def asigna(p, cand, etiqueta, idioma, fecha=''):
    cand = list({c['id']: c for c in cand}.values())
    # varias cartas con ese nombre y número: si el producto tiene fecha fiable (TCGplayer pone la de alta,
    # hoy, a los que no la saben), vale la expansión cuyo año coincide, solo si es una
    if len(cand) > 1 and fecha and fecha < '2026-09-01':
        dist = {c['id']: abs(int((sets[c['s']].get('rel') or '0000')[:4]) - int(fecha[:4])) for c in cand}
        mejor = min(dist.values())
        cerca = [c for c in cand if dist[c['id']] == mejor]
        if len(cerca) == 1 and mejor <= 1:
            cand = cerca
    if len(cand) != 1:
        revisar.append({'idioma': idioma, 'grupo': p['gn'], 'producto': p['n'], 'numero': p['num'], 'tcgplayer_id': p['id'],
                        'motivo': 'varias cartas base' if cand else 'sin carta base en la app', 'cartas': [c['id'] for c in cand]})
        return
    k = slug(etiqueta)
    nv[k] = etiqueta
    if k not in cartas[cand[0]['id']]:
        cartas[cand[0]['id']].append(k)


# ------------------------------------------------------------------ inglés
en = [c for c in catalogo['cartas'] if c.get('l') != 'ja']
ya = {c['tp_id'] for c in catalogo['cartas'] if c.get('tp_id')}   # también las japonesas que TCGplayer lista en su catálogo inglés
idx = defaultdict(list)
for c in en:
    total = (str(c.get('ni') or '').split('/') + [''])[1].lstrip('0') or str(sets[c['s']].get('tot') or '')
    idx[(cl(c['n']), num(c['num']), total)].append(c)
    idx[(cl(c['n']), num(c['num']), '')].append(c)
for p in todos(3):
    if not (p['hp'] and p['num'] and RX.search(base(p['n']))) or p['id'] in ya or p['id'] in MISMA_CARTA:
        continue
    etiq = nombre_variante(p)
    if not etiq:
        continue
    total = (p['num'].split('/') + [''])[1].lstrip('0')
    cand = idx.get((cl(base(p['n'])), num(p['num']), total)) or idx.get((cl(base(p['n'])), num(p['num']), ''))
    if p['id'] in A_MANO:
        cand = [c for c in en if c['id'] == A_MANO[p['id']]]
    asigna(p, cand or [], etiq, 'en', p['fecha'])

# ------------------------------------------------------------------ japonés
ja = [c for c in catalogo['cartas'] if c.get('l') == 'ja']
cod_app, nom_app = defaultdict(list), defaultdict(list)
for k, v in sets.items():
    if k.startswith('ja-'):
        if v.get('cod'):
            cod_app[cl(v['cod'])].append(k)
        nom_app[cl(v['n'])].append(k)
idj = defaultdict(list)
for c in ja:
    idj[(c['s'], num(c['num']), cl(re.sub(r'\s*\(.*$', '', c['n'])))].append(c)
yaj = {c['tp_id'] for c in ja if c.get('tp_id')}
for p in todos(85):
    if not (p['hp'] and p['num'] and RX.search(base(p['n']))) or p['id'] in yaj:
        continue
    etiq = nombre_variante(p)
    if not etiq:
        continue
    ab = cl(p['ab'])
    ss = cod_app.get(ab) if ab and p['ab'].strip().upper() != 'M-P' else None
    ss = ss or nom_app.get(cl(re.sub(r'^[^:]{1,14}:\s*', '', p['gn'])), [])
    cand = [c for s in ss for c in idj.get((s, num(p['num']), cl(base(p['n']))), [])]
    asigna(p, cand, etiq, 'ja')

# ------------------------------------------------------------------ formas de impresión (Normal / Holo / Reverse / 1.ª ed.)
# TCGdex se deja formas sin marcar (casi todas las Reverse Holo de la era EX, las holo de promos…).
# TCGplayer lista, por producto, en qué formas se vende: Normal, Holofoil, Reverse Holofoil, 1st Edition.
FORMAS = {'Normal': 'normal', 'Holofoil': 'holo', 'Reverse Holofoil': 'reverse', '1st Edition': 'firstEdition', '1st Edition Holofoil': 'firstEdition'}
con_tp = {c['tp_id']: c for c in catalogo['cartas'] if c.get('tp_id')}
formas = defaultdict(set)
for cat_id in (3, 85):
    for g in m.pedir(f'https://tcgcsv.com/tcgplayer/{cat_id}/groups', cache=False)['results']:
        pr = (m.pedir(f'https://tcgcsv.com/tcgplayer/{cat_id}/{g["groupId"]}/products', pausa=0.05) or {}).get('results', [])
        if not any(x['productId'] in con_tp for x in pr):
            continue
        for x in (m.pedir(f'https://tcgcsv.com/tcgplayer/{cat_id}/{g["groupId"]}/prices', pausa=0.05) or {}).get('results', []):
            if x['productId'] in con_tp and x['subTypeName'] in FORMAS:
                formas[x['productId']].add(FORMAS[x['subTypeName']])
reemplaza, anadidas = {}, Counter()
for tp, fs in formas.items():
    c = con_tp[tp]
    # Una carta japonesa que traje yo con «normal» por defecto y que TCGplayer vende solo en holo:
    # su «normal» era un supuesto, no un dato → se cambia por «holo». El resto solo suma.
    # (variantes.json no depende de si el catálogo ya lo aplicó: se puede regenerar las veces que haga falta)
    if c['id'].startswith('ja-tp') and fs == {'holo'} and c['v'] in (['normal'], ['holo']):
        reemplaza[c['id']] = ['normal', 'holo']
        anadidas['holo (sustituye a normal)'] += c['v'] == ['normal']
        continue
    for k in sorted(fs):
        if k not in cartas[c['id']]:
            cartas[c['id']].append(k)
        if k not in c['v']:
            anadidas[k] += 1
print('formas añadidas desde TCGplayer:', dict(anadidas))

json.dump({'nv': dict(sorted(nv.items())), 'cartas': dict(sorted(cartas.items())), 'reemplaza': reemplaza, 'revisar': revisar},
          open(os.path.join(AQUI, 'variantes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
total = sum(len(v) for v in cartas.values())
print(f'variantes nuevas: {total} en {len(cartas)} cartas · {len(nv)} nombres distintos · a revisar: {len(revisar)}')
print('más usadas:', Counter(k for v in cartas.values() for k in v).most_common(12))
