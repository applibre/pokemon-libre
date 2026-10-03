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
