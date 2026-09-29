# -*- coding: utf-8 -*-
"""
Pokémon Libre · hojas de contacto para revisar imágenes a ojo

Una imagen equivocada es peor que ninguna: marcarías la carta que no es.
Así que todo lo que entra se mira. Esto pega las cartas en hojas de 24
con su identificador debajo, para verlas de golpe.

    python scripts/hoja-contacto.py ja      las japonesas
    python scripts/hoja-contacto.py todo    todas

Escribe scripts/.cache/hojas/hoja-NN.png
"""

import json
import os
import sys

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SALIDA = os.path.join(AQUI, '.cache', 'hojas')
COLS, FILAS = 6, 4
ANCHO, ALTO = 165, 231


def main():
    que = sys.argv[1] if len(sys.argv) > 1 else 'ja'
    cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
    cartas = [c for c in cat['cartas'] if que == 'todo' or c.get('l') == 'ja']
    cartas.sort(key=lambda c: (cat['sets'].get(c['s'], {}).get('o', 9999), str(c['num'])))
    os.makedirs(SALIDA, exist_ok=True)
    for f in os.listdir(SALIDA):
        os.remove(os.path.join(SALIDA, f))

    porHoja = COLS * FILAS
    hojas = 0
    for i in range(0, len(cartas), porHoja):
        grupo = cartas[i:i + porHoja]
        hoja = Image.new('RGB', (COLS * ANCHO, FILAS * (ALTO + 24)), 'white')
        d = ImageDraw.Draw(hoja)
        for n, c in enumerate(grupo):
            ruta = os.path.join(RAIZ, 'data', 'cartas', c['id'] + '.webp')
            x, y = (n % COLS) * ANCHO, (n // COLS) * (ALTO + 24)
            if os.path.exists(ruta):
                im = Image.open(ruta).convert('RGB').resize((ANCHO - 8, ALTO - 8))
                hoja.paste(im, (x + 4, y + 20))
            else:
                d.text((x + 6, y + 100), 'SIN IMAGEN', fill='red')
            set_n = cat['sets'].get(c['s'], {}).get('n', '')[:16]
            d.text((x + 4, y + 5), f"{c['n'][:20]} {c.get('ni') or c['num']}", fill='black')
            d.text((x + 4, y + ALTO + 10), set_n, fill='gray')
        hojas += 1
        hoja.save(os.path.join(SALIDA, f'hoja-{hojas:02d}.png'))

    print(f'{len(cartas)} cartas en {hojas} hojas · {SALIDA}')


if __name__ == '__main__':
    main()
