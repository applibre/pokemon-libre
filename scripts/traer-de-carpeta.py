# -*- coding: utf-8 -*-
"""
Pokémon Libre · traer las cartas que faltan desde la tienda Carpeta

Carpeta (plan-tienda-tcg/web) tiene TODAS las cartas de Pokémon, en inglés y en
japonés; Pokémon Libre solo las de tus 17 Pokémon, y en japonés le faltaban 274
(sobre todo promos: Sword & Shield, XY, Sun & Moon…). La lista de lo que falta sale
de la auditoría (plan-tienda-tcg/herramientas/auditoria-pokemon-libre/faltan-ja.csv).

    python scripts/traer-de-carpeta.py

Qué hace, para cada carta que falta:
  · elige el producto BASE de TCGplayer (no la variante «Mirror Holofoil»…);
  · la deja con la misma forma que las demás japonesas (l:'ja', ni, j, enlace TCGplayer);
  · copia su imagen ORIGINAL de Carpeta y la guarda a 245 y 600 px, igual que
    bajar-imagenes.py (data/cartas y data/cartas/g);
  · apunta la dirección de origen en imagenes-rescatadas.json.
Escribe scripts/cartas-carpeta.json, que lee scripts/catalogo.mjs (paso 5.5b).
Es repetible: lo que ya está no se vuelve a tocar.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.request

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
GYM = os.path.dirname(RAIZ)
CARPETA = os.path.join(GYM, 'plan-tienda-tcg', 'web')
AUDITORIA = os.path.join(GYM, 'plan-tienda-tcg', 'herramientas', 'auditoria-pokemon-libre', 'faltan-ja.csv')
CARTAS = os.path.join(RAIZ, 'data', 'cartas')
GRANDES = os.path.join(CARTAS, 'g')
sys.path.insert(0, os.path.join(CARPETA, 'scripts', 'catalogo'))
import importar as m  # noqa: E402  (pedir() con caché de tcgcsv)

HOY = '2026-10-01'
catalogo = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
objetivos = json.load(open(os.path.join(AQUI, 'objetivos.json'), encoding='utf-8'))
POKEMON = objetivos['principales'] + objetivos['familias']
NO_ES_POKEMON = re.compile(r'\b(doll|spirit link|tool|stadium|candy|supporter)\b', re.I)
ja_carpeta = json.load(open(os.path.join(CARPETA, 'data', 'catalogo', 'pokemon-ja.json'), encoding='utf-8'))
por_pid = {c['ext']['tcgplayer']: c for c in ja_carpeta['cartas']}


def cl(t):
    return re.sub(r'[^a-z0-9]', '', str(t).lower().replace('é', 'e'))


def base(n):
    """«Pikachu - 001/S-P (Mirror Holofoil)» → «Pikachu»."""
    n = re.sub(r'\s*\[[^\]]*\]', '', n)
    n = re.sub(r'\s*\([^)]*\)', '', n)
    n = re.sub(r'\s+-\s+[A-Za-z]*\d[\w/ -]*$', '', n)      # «- 001/S-P», «- SM04», «- 133/M-P»
    n = re.sub(r'\s+-\s+[A-Z]{1,5}(-[A-Z]{1,5})?$', '', n)  # «- S-P» (promo sin número)
    return n.strip()


def num(n):
    n = str(n or '').split('/')[0].strip().lower()
    return re.sub(r'^([a-z]*)0+(?=\d)', r'\1', n)


# ------------------------------------------------------------------ sets de la app
cod_app, nom_app = {}, {}
for k, v in catalogo['sets'].items():
    if k.startswith('ja-'):
        if v.get('cod'):
            cod_app.setdefault(cl(v['cod']), []).append(k)
        nom_app.setdefault(cl(v['n']), []).append(k)


def set_existente(g):
    ab = cl(g['ab'])
    # «M-P» (promos de Mega, 2025) y «MP» (Miscellaneous Promos) solo se parecen al quitar el guion
    if ab and ab in cod_app and g['ab'].strip().upper() != 'M-P':
        return cod_app[ab][0]
    n = cl(re.sub(r'^[^:]{1,14}:\s*', '', g['gn']))
    return (nom_app.get(n) or [None])[0]


# ------------------------------------------------------------------ qué falta
filas = list(csv.DictReader(open(AUDITORIA, encoding='utf-8-sig')))
grupos_ja = {g['groupId']: g for g in m.pedir('https://tcgcsv.com/tcgplayer/85/groups', cache=False)['results']}
productos = {}


def de_grupo(gid):
    if gid not in productos:
        productos[gid] = {}
        for p in (m.pedir(f'https://tcgcsv.com/tcgplayer/85/{gid}/products') or {}).get('results', []):
            productos[gid][p['productId']] = p
    return productos[gid]


gid_de = {}
for g in grupos_ja.values():
    gid_de[g['name']] = g['groupId']

cartas, sets_nuevos, sin_imagen = [], {}, []
ya = {c['id'] for c in catalogo['cartas']}
for f in filas:
    gid = gid_de[f['grupo_tcgplayer']]
    g = grupos_ja[gid]
    pid = int(f['tcgplayer_id'])
    elegido = de_grupo(gid)[pid]
    ext = lambda p: {e['name']: e['value'] for e in p.get('extendedData') or []}
    # el producto BASE: mismo número y mismo nombre base, sin variante entre paréntesis
    clave = (num(ext(elegido).get('Number')), cl(base(elegido['name'])))
    base_ = [p for p in de_grupo(gid).values()
             if (num(ext(p).get('Number')), cl(base(p['name']))) == clave and '(' not in p['name']]
    if base_ and '(' in elegido['name']:
        elegido = sorted(base_, key=lambda p: p['productId'])[0]
        pid = elegido['productId']
    e = ext(elegido)
    nombre = base(elegido['name'])
    if NO_ES_POKEMON.search(nombre):
        continue
    # sin número no hay forma de saber qué carta es: «Poké-lun TV's Pikachu and Friends - S-P» es la #361 que ya está
    if not re.search(r'\d', e.get('Number') or f['numero']):
        continue
    suyos = [p['id'] for p in POKEMON if re.search(r'\b' + p['nombre'] + r'\b', nombre, re.I)]
    if not suyos:
        continue
    cid = f'ja-tp{pid}'
    if cid in ya:
        continue
    sid = set_existente({'ab': g.get('abbreviation') or '', 'gn': g['name']})
    if not sid:
        sid = f'ja-tp{gid}'
        if sid not in sets_nuevos:
            rel = (g.get('publishedOn') or '')[:10]
            numeros = [ext(p).get('Number') or '' for p in de_grupo(gid).values()]
            totales = [int(x.split('/')[1]) for x in numeros if '/' in x and x.split('/')[1].isdigit()]
            sets_nuevos[sid] = {
                'n': re.sub(r'^[^:]{1,14}:\s*', '', g['name']).strip(),
                'rel': rel if rel and rel < HOY else '',   # TCGplayer pone la fecha de alta a los que no saben la real
                'tot': max(totales) if totales else 0,
                'ja': True, 'cod': (g.get('abbreviation') or '').strip(),
            }
    trozos = (e.get('Number') or f['numero']).split('/')
    es_total = len(trozos) > 1 and trozos[1].isdigit()
    ficha = {
        'id': cid, 'n': nombre, 'p': suyos, 's': sid, 'num': trozos[0],
        'r': '' if e.get('Rarity') in (None, 'None') else e['Rarity'], 'v': ['normal'], 'img': None, 'ill': '', 'l': 'ja',
        'ni': (e.get('Number') or f['numero']) if es_total else trozos[0], 'tp_id': pid,
    }
    carp = por_pid.get(pid)
    if carp and carp.get('ilustrador'):
        ficha['ill'] = carp['ilustrador']
    j = {}
    if e.get('Stage'):
        j['e'] = e['Stage']
    if (e.get('HP') or '').isdigit():
        j['ps'] = int(e['HP'])
    if j:
        ficha['j'] = j
    # imagen: el original que ya bajó Carpeta
    fuente = None
    if carp and carp.get('img'):
        d, r = carp['img'].split('/', 1)
        for ext_ in ('jpg', 'png', 'webp', 'gif'):
            p = os.path.join(CARPETA, 'data', 'img-maestros', d, r.replace('/', os.sep) + '.' + ext_)
            if os.path.exists(p):
                fuente = p
                break
    cartas.append((ficha, fuente, (carp or {}).get('img_url', '').split('|')[0]))
    if not fuente:
        sin_imagen.append(f"{nombre} {f['numero']} ({g['name']})")

# ------------------------------------------------------------------ inglés: lo que TCGdex no tiene
# Cartas de TUS Pokémon que existen (TCGplayer) y que TCGdex no trae: la promo Kids' WB y las
# promos nuevas de Mega Evolution. Se vieron una a una antes de añadirlas. Quedan fuera las
# variantes con sello (093 «Winner») y la e-Reader Sample (TCGplayer no tiene su foto).
EN_EXTRAS = [
    # (grupo de TCGplayer, producto, id en Libre, set en Libre, número, número impreso)
    ("Kids WB Promos", 162272, 'kidswb-5', 'kidswb', '5', '5/5'),
    ("ME: Mega Evolution Promo", 712963, 'mep-093', 'mep', '093', '093'),
    ("ME: Mega Evolution Promo", 713257, 'mep-107', 'mep', '107', '107'),
    ("ME: Mega Evolution Promo", 713256, 'mep-109', 'mep', '109', '109'),
]
SETS_EN_NUEVOS = {'kidswb': {'n': "Kids' WB Promos", 'rel': '2004-07-02', 'tot': 5}}
grupos_en = {g['name']: g['groupId'] for g in m.pedir('https://tcgcsv.com/tcgplayer/3/groups', cache=False)['results']}
for gn, pid, cid, sid, numero, ni in EN_EXTRAS:
    if cid in ya:
        continue
    prod = next(p for p in (m.pedir(f'https://tcgcsv.com/tcgplayer/3/{grupos_en[gn]}/products') or {}).get('results', []) if p['productId'] == pid)
    e = {x['name']: x['value'] for x in prod.get('extendedData') or []}
    nombre = base(prod['name'])
    ficha = {
        'id': cid, 'n': nombre, 'p': [p['id'] for p in POKEMON if re.search(r'\b' + p['nombre'] + r'\b', nombre, re.I)],
        's': sid, 'num': numero, 'r': '' if e.get('Rarity') in (None, 'None') else e['Rarity'], 'v': ['normal'],
        'img': None, 'ill': '', 'ni': ni, 'tp_id': pid,
    }
    j = {}
    if e.get('Stage'):
        j['e'] = e['Stage']
    if (e.get('HP') or '').isdigit():
        j['ps'] = int(e['HP'])
    if j:
        ficha['j'] = j
    url = f'https://tcgplayer-cdn.tcgplayer.com/product/{pid}_in_1000x1000.jpg'
    datos = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    if sid in SETS_EN_NUEVOS:
        sets_nuevos[sid] = SETS_EN_NUEVOS[sid]
    cartas.append((ficha, datos, url))

# ------------------------------------------------------------------ imágenes (como bajar-imagenes.py)
os.makedirs(CARTAS, exist_ok=True)
os.makedirs(GRANDES, exist_ok=True)


def guarda(im, destino, ancho):
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA')
    if im.width > ancho:
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    if im.mode == 'RGBA':
        fondo = Image.new('RGB', im.size, (255, 255, 255))
        fondo.paste(im, mask=im.split()[-1])
        im = fondo
    im.save(destino, 'WEBP', quality=82, method=5)


rescatadas = json.load(open(os.path.join(AQUI, 'imagenes-rescatadas.json'), encoding='utf-8'))
salida, hechas = [], 0
for ficha, fuente, url in cartas:
    if not fuente:
        continue  # sin imagen real no entra: una carta que se ve vacía no sirve
    im = Image.open(io.BytesIO(fuente) if isinstance(fuente, bytes) else fuente)
    im.load()
    # BREAK/LEGEND se imprimen de lado; las demás ya son verticales
    if im.width > im.height:
        im = im.transpose(Image.ROTATE_90)
    if not (0.6 <= im.width / im.height <= 0.8):
        sin_imagen.append(f"{ficha['n']} {ficha['num']}: proporción rara {im.width}x{im.height}")
        continue
    guarda(im, os.path.join(CARTAS, ficha['id'] + '.webp'), 245)
    guarda(im, os.path.join(GRANDES, ficha['id'] + '.webp'), 600)
    if url:
        rescatadas[ficha['id']] = url
    salida.append(ficha)
    hechas += 1

usados = {f['s'] for f in salida}
sets_final = {k: v for k, v in sets_nuevos.items() if k in usados}
json.dump({'sets': sets_final, 'cartas': salida}, open(os.path.join(AQUI, 'cartas-carpeta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(rescatadas, open(os.path.join(AQUI, 'imagenes-rescatadas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'cartas nuevas: {len(salida)} · sets nuevos: {len(sets_final)} · sin imagen (no entran): {len(sin_imagen)}')
for s in sin_imagen:
    print('   sin imagen:', s)
