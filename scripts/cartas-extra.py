# -*- coding: utf-8 -*-
"""
Pokémon Libre · las cartas que TCGdex no tiene

TCGdex se deja fuera productos ingleses enteros: el Pokémon Trading Card
Game Classic de 2023, los box topper de 2003, la World Collection de 2010
y alguna carta suelta con número raro (Burning Shadows 18a). Se traen de
pkmncards, una base de datos solo en inglés y bien mantenida, leyendo la
ficha de cada carta: nombre, colección, número, rareza, fecha, quién la
ilustró, su texto y su imagen.

    python scripts/cartas-extra.py

Escribe scripts/cartas-extra.json, que scripts/catalogo.mjs mezcla con lo
de TCGdex, y apunta sus imágenes en scripts/imagenes-rescatadas.json para
que las descargue el mismo script de siempre.
"""

import html
import json
import os
import re
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}

# Colecciones que hay que crear, con el identificador que llevarán aquí.
# La fecha y el total salen de la propia ficha de la carta.
COLECCIONES = {
    'pokemon-trading-card-game-classic-charizard-clc': ('clc', 'TCG Classic (Charizard)'),
    'pokemon-trading-card-game-classic-blastoise-clb': ('clb', 'TCG Classic (Blastoise)'),
    'pokemon-trading-card-game-classic-venusaur-clv': ('clv', 'TCG Classic (Venusaur)'),
    'world-collection': ('wc', 'World Collection'),
    'box-topper': ('bt', 'Box Topper'),
    'burning-shadows-bus': ('sm3', None),      # ya existe: solo se añade la carta
}

MESES = {'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
         'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'}


def limpio(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip()


def campos(zona, clase):
    """Los trozos de la página marcados con esa clase."""
    pat = r'<[a-z]+[^>]*class="[^"]*\b' + clase + r'\b[^"]*"[^>]*>(.{0,400}?)</[a-z]+>'
    return [limpio(m.group(1)) for m in re.finditer(pat, zona, re.S)]


def ficha(slug):
    """Lee la ficha de pkmncards. Solo se mira dentro del <article>: fuera
       la página enseña una carta al azar y sus datos se colarían."""
    u = 'https://pkmncards.com/card/' + slug + '/'
    h = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45).read().decode('utf-8', 'ignore')
    art = h[h.find('<article'):h.find('</article>')] if '<article' in h else h
    img = re.search(r'og:image" content="([^"]*)"', h)
    titulo = html.unescape(re.search(r'<title>([^<]*)</title>', h).group(1))

    d = {'slug': slug, 'url': u, 'img': img.group(1) if img else None, 'n': titulo.split(' · ')[0].strip()}

    num = next((x for x in campos(art, 'number') if x.startswith('#')), '')
    if num:
        d['num'] = num.lstrip('#').strip()
    tot = re.search(r'#\s*' + re.escape(d.get('num', 'imposible')) + r'\s*/\s*(\d+)', limpio(art))
    if tot:
        d['tot'] = int(tot.group(1))

    rar = campos(art, 'rarity')
    if rar:
        d['r'] = '' if rar[0].lower().startswith('no rarity') else rar[0].split(':')[0].strip()

    fecha = next((x for x in campos(art, 'date') if re.search(r'[A-Za-z]{3}\s+\d{1,2},\s*\d{4}', x)), '')
    mf = re.search(r'([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})', fecha)
    if mf:
        d['rel'] = '{0}-{1}-{2:02d}'.format(mf.group(3), MESES.get(mf.group(1).lower(), '01'), int(mf.group(2)))

    ill = campos(art, 'illus')
    if ill:
        d['ill'] = re.sub(r'^illus\.\s*', '', ill[0]).strip()

    hp = next((x for x in campos(art, 'hp') if x.endswith('HP')), '')
    if hp:
        d['ps'] = int(re.sub(r'\D', '', hp))

    et = campos(art, 'stage')
    if et:
        d['etapa'] = et[0]

    ev = next((x for x in campos(art, 'evolves') if x.startswith('Evolves from')), '')
    if ev:
        d['de'] = ev.replace('Evolves from', '').split(' and ')[0].strip()

    fl = campos(art, 'flavor')
    if fl and 5 < len(fl[0]) < 400:
        d['txt'] = fl[0].strip('“”" ')
    return d


def main():
    slugs = json.load(open(os.path.join(AQUI, 'cartas-extra-lista.json'), encoding='utf-8'))
    salida = []
    for i, s in enumerate(slugs, 1):
        try:
            d = ficha(s)
        except Exception as e:
            print('  ! ' + s + ': ' + str(e))
            continue
        grupo = next((g for g in COLECCIONES if g in s), None)
        if not grupo:
            print('  ! ' + s + ': no se sabe a que coleccion va')
            continue
        d['set'], d['set_n'] = COLECCIONES[grupo]
        d['id'] = d['set'] + '-' + str(d.get('num', '?'))
        salida.append(d)
        print('  {0:>2}/{1} {2:<14} {3:<4} {4:<5} {5} {6}'.format(
            i, len(slugs), d['n'], d['set'], d.get('num', '?'), d.get('rel', '?'), d.get('ill', '')))
        time.sleep(0.5)

    json.dump(salida, open(os.path.join(AQUI, 'cartas-extra.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    # sus imagenes van por el mismo camino que los demas rescates
    ruta = os.path.join(AQUI, 'imagenes-rescatadas.json')
    rescate = json.load(open(ruta, encoding='utf-8')) if os.path.exists(ruta) else {}
    nuevas = 0
    for d in salida:
        if d.get('img') and rescate.get(d['id']) != d['img']:
            rescate[d['id']] = d['img']
            nuevas += 1
    json.dump(rescate, open(ruta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print('')
    print('Fichas leidas: {0} de {1} - imagenes apuntadas: {2}'.format(len(salida), len(slugs), nuevas))


if __name__ == '__main__':
    main()
