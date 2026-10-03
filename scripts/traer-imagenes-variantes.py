# -*- coding: utf-8 -*-
"""
Pokémon Libre · la foto de cada carta-variante (la Pikachu con el sello de Pokémon Day…)

    python scripts/traer-imagenes-variantes.py

Una variante especial (sello, Cosmos Holo, Prize Pack, Jumbo…) es OTRA carta, y se ve distinta:
por eso lleva su propia foto, la de su producto de TCGplayer (scripts/variantes.json → extras).
Se guarda a 245 y 600 px como las demás (data/cartas/<id>.webp y data/cartas/g/<id>.webp), con
id «<carta base>~<clave>». Una variante sin foto utilizable NO entra en el catálogo: una carta
que se ve vacía no sirve (catalogo.mjs solo crea las que tienen foto).
"""
import io
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
CARTAS = os.path.join(RAIZ, 'data', 'cartas')
GRANDES = os.path.join(CARTAS, 'g')
os.makedirs(GRANDES, exist_ok=True)

# Respaldo: lo que ya bajó Carpeta (la tienda local) de otras fuentes, por identificador de TCGplayer
CARPETA_WEB = os.path.join(os.path.dirname(RAIZ), 'plan-tienda-tcg', 'web', 'data')
de_carpeta = {}
for f in ('pokemon.json', 'pokemon-ja.json'):
    try:
        for c in json.load(open(os.path.join(CARPETA_WEB, 'catalogo', f), encoding='utf-8'))['cartas']:
            tp = (c.get('ext') or {}).get('tcgplayer')
            if tp and c.get('img'):
                de_carpeta[int(tp)] = c['img']
    except FileNotFoundError:
        pass


def maestra(tp):
    r = de_carpeta.get(tp)
    if not r or '/' not in r:
        return None
    d, resto = r.split('/', 1)
    for ext_ in ('jpg', 'png', 'webp', 'gif'):
        ruta = os.path.join(CARPETA_WEB, 'img-maestros', d, resto.replace('/', os.sep) + '.' + ext_)
        if os.path.exists(ruta):
            return ruta
    return None


extras = json.load(open(os.path.join(AQUI, 'variantes.json'), encoding='utf-8'))['extras']
trabajo = [(f'{base}~{k}', d['tp']) for base, ex in extras.items() for k, d in ex.items()]


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


def una(t):
    cid, tp = t
    if os.path.exists(os.path.join(GRANDES, cid + '.webp')) and os.path.exists(os.path.join(CARTAS, cid + '.webp')):
        return cid, 'ya', None
    for tam in ('1000x1000', '400x400'):
        url = f'https://tcgplayer-cdn.tcgplayer.com/product/{tp}_in_{tam}.jpg'
        try:
            datos = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
            im = Image.open(io.BytesIO(datos))
            im.load()
        except Exception as e:  # noqa: BLE001
            err = str(e)
            continue
        if im.width > im.height:
            im = im.transpose(Image.ROTATE_90)
        if not (0.6 <= im.width / im.height <= 0.8):
            return cid, 'proporción rara', f'{im.width}x{im.height}'
        guarda(im, os.path.join(CARTAS, cid + '.webp'), 245)
        guarda(im, os.path.join(GRANDES, cid + '.webp'), 600)
        return cid, 'ok', url
    ruta = maestra(tp)
    if ruta:
        im = Image.open(ruta)
        im.load()
        if im.width > im.height:
            im = im.transpose(Image.ROTATE_90)
        if 0.6 <= im.width / im.height <= 0.8:
            guarda(im, os.path.join(CARTAS, cid + '.webp'), 245)
            guarda(im, os.path.join(GRANDES, cid + '.webp'), 600)
            return cid, 'ok', 'carpeta:' + os.path.relpath(ruta, CARPETA_WEB).replace(os.sep, '/')
    return cid, 'sin foto', err


with ThreadPoolExecutor(6) as ex:
    res = list(ex.map(una, trabajo))
cuenta = {}
for cid, estado, _ in res:
    cuenta[estado] = cuenta.get(estado, 0) + 1
print('imágenes de variantes:', cuenta)
for cid, estado, dato in res:
    if estado not in ('ok', 'ya'):
        print('   ', cid, estado, dato)

ruta = os.path.join(AQUI, 'imagenes-rescatadas.json')
resc = json.load(open(ruta, encoding='utf-8'))
for cid, estado, dato in res:
    if estado == 'ok' and str(dato).startswith('http'):   # las de Carpeta son un fichero local, no una URL
        resc[cid] = dato
json.dump(resc, open(ruta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ fotos de carta base que enseñaban la variante
# Revisión a ojo (02-10-2026): la foto de estas cartas NORMALES era en realidad la de su variante
# (la Detective Pikachu SM190 con el logo de la película, la promo 1 con el error de 1.ª edición, las
# del Base Set en 1.ª edición, sin sombra). Se pone la foto de su producto normal de TCGplayer.
# bajar-imagenes.py respeta esta lista (scripts/fotos-base.json).
FOTO_BASE = ['basep-1', 'smp-SM190', 'smp-SM198'] + [f'base1-{n}' for n in (2, 4, 14, 15, 24, 29, 30, 42, 44, 46, 50, 58, 63)]
cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
por = {c['id']: c for c in cat['cartas']}
ruta_fb = os.path.join(AQUI, 'fotos-base.json')
fb = json.load(open(ruta_fb, encoding='utf-8')) if os.path.exists(ruta_fb) else {}
for cid in FOTO_BASE:
    if cid in fb:
        continue
    url = f"https://tcgplayer-cdn.tcgplayer.com/product/{por[cid]['tp_id']}_in_1000x1000.jpg"
    im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()))
    im.load()
    guarda(im, os.path.join(CARTAS, cid + '.webp'), 245)
    guarda(im, os.path.join(GRANDES, cid + '.webp'), 600)
    fb[cid] = url
json.dump(fb, open(ruta_fb, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('fotos de carta base corregidas:', len(fb))

# ------------------------------------------------------------------ fotos de referencia
# Si la foto de una variante es prácticamente la de su carta normal (TCGplayer reutiliza la foto),
# no enseña el sello o el brillo: la ficha lo avisa («foto de referencia»).
from PIL import ImageOps  # noqa: E402


def vec(cid):
    im = ImageOps.autocontrast(Image.open(os.path.join(GRANDES, cid + '.webp')).convert('L').resize((90, 126)))
    return list(im.get_flattened_data())


def dist(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


# vistas a ojo: el sello es pequeño pero SÍ se ve en la foto (la calabaza, la palabra STAFF)
SE_VE = {'swsh6-57~trick-or-trade-2021-copyright-date', 'swshp-SWSH068~prerelease-staff'}
ref = []
for base, ex in extras.items():
    if not os.path.exists(os.path.join(GRANDES, base + '.webp')):
        continue
    vb = vec(base)
    vistas = []
    for k in ex:
        cid = f'{base}~{k}'
        if not os.path.exists(os.path.join(GRANDES, cid + '.webp')):
            continue
        vv = vec(cid)
        if cid not in SE_VE and (dist(vv, vb) < 2.0 or any(dist(vv, o) < 1.0 for o in vistas)):
            ref.append(cid)
        vistas.append(vv)
json.dump(sorted(ref), open(os.path.join(AQUI, 'fotos-referencia.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('variantes con foto de referencia (no enseña la diferencia):', len(ref), ref)
