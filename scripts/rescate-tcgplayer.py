# -*- coding: utf-8 -*-
"""
Pokémon Libre · la foto de TCGplayer para las cartas que siguen sin foto real

Después de TCGdex, pokemontcg.io y Bulbapedia, las que quedan sin foto (scripts/sin-foto.json)
y tienen su producto de TCGplayer localizado (tp_id, o scripts/tcgplayer.json) toman la foto de
ese producto. Solo se acepta si la imagen existe y tiene forma de carta (no la de un sobre).
Se apunta en scripts/imagenes-rescatadas.json y se borra la ficha dibujada, para que
bajar-imagenes.py la descargue en sus dos tamaños.

    python scripts/rescate-tcgplayer.py
    python scripts/bajar-imagenes.py
"""
import io
import json
import os
import urllib.request

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
por = {c['id']: c for c in cat['cartas']}
tp = json.load(open(os.path.join(AQUI, 'tcgplayer.json'), encoding='utf-8'))
sin = json.load(open(os.path.join(AQUI, 'sin-foto.json'), encoding='utf-8'))
ruta_r = os.path.join(AQUI, 'imagenes-rescatadas.json')
resc = json.load(open(ruta_r, encoding='utf-8'))

hechas, fallan = 0, []
for cid in sin:
    c = por.get(cid)
    pid = (c or {}).get('tp_id') or (tp.get(cid) or {}).get('tp')
    if not c or not pid:
        continue
    url = f'https://tcgplayer-cdn.tcgplayer.com/product/{pid}_in_1000x1000.jpg'
    try:
        datos = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
        im = Image.open(io.BytesIO(datos))
        if not 0.6 <= im.width / im.height <= 0.8:
            raise ValueError(f'no tiene forma de carta: {im.width}x{im.height}')
    except Exception as e:  # noqa: BLE001
        fallan.append(f'{cid}: {e}')
        continue
    resc[cid] = url
    for d in ('', 'g'):
        f = os.path.join(RAIZ, 'data', 'cartas', d, cid + '.webp')
        if os.path.exists(f):
            os.remove(f)
    hechas += 1
json.dump(resc, open(ruta_r, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'fotos de TCGplayer: {hechas}')
for f in fallan:
    print('   sin foto:', f)
