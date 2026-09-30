# -*- coding: utf-8 -*-
"""
Pokémon Libre · logos oficiales y series de cada expansión

Pokellector publica el logo de cada expansión, inglesa y japonesa, y las
agrupa por SERIE («Mega Evolution Series», «Scarlet & Violet Series»…),
cada serie con su propio logo. Cada expansión lleva además su código
(name="BW9"). Aquí se leen las dos listas y se emparejan con NUESTRAS
colecciones en tres pasadas, de más a menos segura:

  1. mismo nombre, ya normalizado
  2. mismo código, si en ninguno de los dos lados hay otra con ese código
  3. un nombre contenido en el otro, si es la única opción

Nada se empareja «a ojo»: lo que no encaja queda en
scripts/.cache/logos-sin-pareja.json para revisarlo, y no se inventa.

Escribe:
  app/public/logos/<id de colección>.webp    el logo de la expansión
  app/public/logos/series/<serie>.webp       el logo de cada serie
  app/public/logos/lista.json                qué logos existen de verdad
  app/public/logos/series.json               id de colección -> serie

    python scripts/logos-pokellector.py
"""

import glob
import io
import json
import os
import re
import time
import unicodedata
import urllib.request

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DESTINO = os.path.join(RAIZ, 'app', 'public', 'logos')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}
FUENTES = {'en': 'https://www.pokellector.com/sets', 'ja': 'https://jp.pokellector.com/sets'}


def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()


def plano(t):
    t = unicodedata.normalize('NFD', str(t or '')).encode('ascii', 'ignore').decode().lower()
    t = t.replace('&', ' and ').replace("'", '')
    t = re.sub(r'\b(the|expansion|series|set)\b', ' ', t)
    return re.sub(r'[^a-z0-9]+', '', t)


def leer(idioma):
    """[{codigo, nombre, logo, serie, serie_logo}] en el orden de la página."""
    h = get(FUENTES[idioma]).decode('utf-8', 'ignore')
    salida = []
    serie, serie_logo = '', ''
    n_serie, pos = -1, 0
    for m in re.finditer(
            r'<h1 class="icon set"><img src="([^"]+)">([^<]+)</h1>'
            r'|<a class="button" name="([^"]*)" href="([^"]*)" title="([^"]*)">\s*<img src="([^"]+\.logo\.\d+\.png)"', h):
        if m.group(2):
            serie_logo, serie = m.group(1), m.group(2).strip()
            n_serie, pos = n_serie + 1, 0
        else:
            nombre = re.sub(r'\s+Set$', '', m.group(5).strip())
            salida.append({'codigo': m.group(3).strip(), 'href': m.group(4), 'nombre': nombre, 'logo': m.group(6),
                           'serie': serie, 'serie_logo': serie_logo, 'ns': n_serie, 'pos': pos})
            pos += 1
    return salida


def codigos_propios(cat):
    """Código de cada colección nuestra: el de TCG Collector en las japonesas
       y la abreviatura oficial de TCGdex en las inglesas."""
    cod = {sid: s.get('cod', '') for sid, s in cat['sets'].items() if s.get('ja')}
    for f in glob.glob(os.path.join(AQUI, '.cache', 'set-*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        if d.get('id') in cat['sets'] and not cat['sets'][d['id']].get('ja'):
            cod[d['id']] = (d.get('abbreviation') or {}).get('official', '')
    return cod


def emparejar(propios, remotos, cod_propio):
    por_nombre, por_codigo = {}, {}
    for r in remotos:
        por_nombre.setdefault(plano(r['nombre']), []).append(r)
        if r['codigo']:
            por_codigo.setdefault(r['codigo'].lower(), []).append(r)
    codigos_nuestros = {}
    for sid, _ in propios:
        c = (cod_propio.get(sid) or '').lower()
        if c:
            codigos_nuestros.setdefault(c, []).append(sid)

    hallados, huerfanos, como = {}, [], {'nombre': 0, 'codigo': 0, 'contenido': 0}
    for sid, s in propios:
        clave = plano(s['n'])
        cand = por_nombre.get(clave, [])
        via = 'nombre'
        if len(cand) != 1:
            c = (cod_propio.get(sid) or '').lower()
            cand, via = [], 'codigo'
            if c and len(por_codigo.get(c, [])) == 1 and len(codigos_nuestros.get(c, [])) == 1:
                cand = por_codigo[c]
        if not cand:
            via = 'contenido'
            tent = [r for k, v in por_nombre.items() for r in v
                    if len(clave) >= 6 and (clave in k or k in clave) and abs(len(k) - len(clave)) <= 4]
            cand = tent if len(tent) == 1 else []
        if cand:
            hallados[sid] = cand[0]
            como[via] += 1
        else:
            huerfanos.append({'id': sid, 'n': s['n'], 'cod': cod_propio.get(sid, '')})
    return hallados, huerfanos, como


def guardar(url, destino, caja):
    if os.path.exists(destino):
        return True
    try:
        im = Image.open(io.BytesIO(get(url))).convert('RGBA')
        im.thumbnail(caja, Image.LANCZOS)
        im.save(destino, 'WEBP', quality=90)
        time.sleep(0.1)
        return True
    except Exception:
        return False


def main():
    cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
    os.makedirs(os.path.join(DESTINO, 'series'), exist_ok=True)
    cod_propio = codigos_propios(cat)
    series, sin_pareja = {}, {}

    for idioma in ('en', 'ja'):
        remotos = leer(idioma)
        propios = [(sid, s) for sid, s in cat['sets'].items() if bool(s.get('ja')) == (idioma == 'ja')]
        hallados, huerfanos, como = emparejar(propios, remotos, cod_propio)

        hechos = 0
        for sid, r in hallados.items():
            if guardar(r['logo'], os.path.join(DESTINO, sid + '.webp'), (360, 160)):
                hechos += 1
            slug = re.sub(r'[^a-z0-9]+', '-', (idioma + ' ' + r['serie']).lower()).strip('-')
            series[sid] = {'serie': r['serie'], 'slug': slug, 's': r['ns'], 'p': r['pos'], 'u': r['href']}
            if r['serie_logo']:
                guardar(r['serie_logo'], os.path.join(DESTINO, 'series', slug + '.webp'), (300, 120))
        sin_pareja[idioma] = huerfanos
        print(f'{idioma}: {len(remotos)} en Pokellector · nuestras {len(propios)} · con logo {hechos} '
              f'(nombre {como["nombre"]}, código {como["codigo"]}, contenido {como["contenido"]}) · sin pareja {len(huerfanos)}')

    ids = sorted(f[:-5] for f in os.listdir(DESTINO) if f.endswith('.webp'))
    ids += sorted('series/' + f[:-5] for f in os.listdir(os.path.join(DESTINO, 'series')) if f.endswith('.webp'))
    json.dump(ids, open(os.path.join(DESTINO, 'lista.json'), 'w', encoding='utf-8'))
    json.dump(series, open(os.path.join(DESTINO, 'series.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    os.makedirs(os.path.join(AQUI, '.cache'), exist_ok=True)
    json.dump(sin_pareja, open(os.path.join(AQUI, '.cache', 'logos-sin-pareja.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    print(f'\nLogos guardados: {len(ids)} · series con logo: {len(os.listdir(os.path.join(DESTINO, "series")))}')
    for idioma in ('en', 'ja'):
        print(f'\nSin pareja [{idioma}] (primeras 14):')
        for x in sin_pareja[idioma][:14]:
            print(f"  {x['id']:<14} {x['cod']:<8} {x['n']}")


if __name__ == '__main__':
    main()
