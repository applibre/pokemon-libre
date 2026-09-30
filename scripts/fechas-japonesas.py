# -*- coding: utf-8 -*-
"""
Pokémon Libre · la fecha de salida de cada expansión japonesa

TCG Collector no publica fechas de las expansiones japonesas, y sin fecha
la app no puede decir cuándo salió una carta ni ordenarlas. Pokellector sí:
la página de cada expansión dice «Released · Sep 16th · 2026». Se lee esa
página para las expansiones que ya tenemos emparejadas (scripts/logos-
pokellector.py guarda su dirección en series.json).

Solo se acepta una fecha con año plausible (1996-2027): una lectura rara
se descarta antes que inventar un año.

    python scripts/fechas-japonesas.py

Escribe scripts/fechas-japonesas.json  { id de colección: 'AAAA-MM-DD' }
"""

import html
import json
import os
import re
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SERIES = os.path.join(RAIZ, 'app', 'public', 'logos', 'series.json')
SALIDA = os.path.join(AQUI, 'fechas-japonesas.json')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}
MES = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}


def get(u):
    for i in range(1, 4):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45).read().decode('utf-8', 'ignore')
        except Exception:
            if i == 3:
                raise
            time.sleep(2 * i)


def fecha(h):
    """«Released | Sep 16th | 2026» -> 2026-09-16"""
    t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' | ', h)))
    m = re.search(r'Released[\s|]+([A-Za-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?[\s|,]+(\d{4})', t)
    if not m:
        return None
    mes, dia, anio = MES.get(m.group(1).lower()), int(m.group(2)), int(m.group(3))
    if not mes or not (1996 <= anio <= 2027) or not (1 <= dia <= 31):
        return None
    return f'{anio:04d}-{mes:02d}-{dia:02d}'


def main():
    series = json.load(open(SERIES, encoding='utf-8'))
    previo = json.load(open(SALIDA, encoding='utf-8')) if os.path.exists(SALIDA) else {}
    salida = dict(previo)
    pendientes = [(sid, s['u']) for sid, s in series.items() if sid.startswith('ja-') and s.get('u') and sid not in salida]
    print(f'Expansiones japonesas con dirección: {len(pendientes) + len(previo)} · por leer: {len(pendientes)}\n', flush=True)

    sin = []
    for i, (sid, url) in enumerate(pendientes, 1):
        try:
            f = fecha(get('https://jp.pokellector.com' + url))
        except Exception as e:
            print(f'  ! {sid}: {e}', flush=True)
            continue
        if f:
            salida[sid] = f
        else:
            sin.append((sid, url))
        if i % 20 == 0:
            print(f'  {i}/{len(pendientes)} · con fecha {len(salida)}', flush=True)
            json.dump(salida, open(SALIDA, 'w', encoding='utf-8'), indent=1)
        time.sleep(0.3)

    json.dump(salida, open(SALIDA, 'w', encoding='utf-8'), indent=1)
    print(f'\nFechas leídas: {len(salida)} · sin fecha legible: {len(sin)}')
    for sid, url in sin[:10]:
        print('  ', sid, url)
    fs = sorted(salida.values())
    if fs:
        print(f'De {fs[0]} a {fs[-1]}')


if __name__ == '__main__':
    main()
