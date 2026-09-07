# -*- coding: utf-8 -*-
"""
Pokémon Libre · descarga de las imágenes de las cartas

Las imágenes viven DENTRO de la app, no enlazadas a un servidor ajeno.
Razón: la API «oficial» de cartas ya cerró una vez, y una colección no
puede quedarse sin fotos porque un servicio de terceros desaparezca.

Cada carta se guarda dos veces:
  · cartas/<id>.webp        245 px de ancho — lo que se ve en la rejilla
  · cartas/g/<id>.webp      600 px de ancho — al abrir la carta

Las que no existen en ninguna fuente reciben una ficha dibujada con su
nombre, set y número: el hueco se ve, pero se puede marcar igual.

    python scripts/bajar-imagenes.py [--rehacer]
"""

import io
import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DATOS = os.path.join(RAIZ, 'data')
CARTAS = os.path.join(DATOS, 'cartas')
GRANDES = os.path.join(CARTAS, 'g')
ASSETS = 'https://assets.tcgdex.net'

REHACER = '--rehacer' in sys.argv

ANCHO_CHICO = 245
ANCHO_GRANDE = 600
PROPORCION = 337 / 245        # la proporción real de los ficheros que sirve TCGdex

os.makedirs(CARTAS, exist_ok=True)
os.makedirs(GRANDES, exist_ok=True)


def baja(url, intentos=3):
    for i in range(1, intentos + 1):
        try:
            pet = urllib.request.Request(url, headers={
                'User-Agent': 'PokemonLibre/1.0 (applibre; coleccion personal)'})
            with urllib.request.urlopen(pet, timeout=45) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        if i < intentos:
            time.sleep(0.5 * i)
    return None


def guarda(datos, destino, ancho):
    """Normaliza a WebP del ancho pedido. Todas las fuentes dan formatos
       distintos (webp, png de 160 KB); aquí todo queda igual."""
    im = Image.open(io.BytesIO(datos))
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA')
    if im.width > ancho:
        alto = round(im.height * ancho / im.width)
        im = im.resize((ancho, alto), Image.LANCZOS)
    if im.mode == 'RGBA':
        fondo = Image.new('RGB', im.size, (255, 255, 255))
        fondo.paste(im, mask=im.split()[-1])
        im = fondo
    im.save(destino, 'WEBP', quality=82, method=5)
    return os.path.getsize(destino)


def fuente(tam):
    for ruta in (r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf'):
        if os.path.exists(ruta):
            try:
                return ImageFont.truetype(ruta, tam)
            except Exception:
                pass
    return ImageFont.load_default()


def es_ficha_dibujada(ruta):
    """Las fichas dibujadas llevan un comentario EXIF que las identifica."""
    try:
        im = Image.open(ruta)
        return b'ficha-dibujada' in (im.info.get('exif') or b'')
    except Exception:
        return False


def ficha_dibujada(carta, sets, destino, ancho):
    """Para las cartas que no existen en ninguna fuente. No es un hueco
       gris: lleva su nombre, su set y su número, para poder reconocerla
       en la mano y marcarla."""
    alto = round(ancho * PROPORCION)
    im = Image.new('RGB', (ancho, alto), (28, 27, 45))
    d = ImageDraw.Draw(im)
    m = round(ancho * 0.09)

    d.rounded_rectangle([m // 2, m // 2, ancho - m // 2, alto - m // 2],
                        radius=round(ancho * 0.05), outline=(92, 88, 150),
                        width=max(1, round(ancho * 0.008)))

    f_nom = fuente(round(ancho * 0.085))
    f_pie = fuente(round(ancho * 0.052))

    # el nombre, partido en líneas que quepan
    palabras = carta['n'].split()
    lineas, actual = [], ''
    for p in palabras:
        prueba = (actual + ' ' + p).strip()
        if d.textlength(prueba, font=f_nom) <= ancho - 2 * m:
            actual = prueba
        else:
            if actual:
                lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)

    y = alto * 0.33
    for ln in lineas[:4]:
        d.text((ancho / 2, y), ln, font=f_nom, fill=(232, 230, 250), anchor='ma')
        y += round(ancho * 0.105)

    s = sets.get(carta['s'], {})
    d.text((ancho / 2, alto * 0.63), s.get('n', carta['s'])[:26],
           font=f_pie, fill=(150, 146, 190), anchor='ma')
    d.text((ancho / 2, alto * 0.70), f"{carta['num']}",
           font=f_pie, fill=(150, 146, 190), anchor='ma')
    d.text((ancho / 2, alto * 0.86), 'sin imagen disponible',
           font=fuente(round(ancho * 0.042)), fill=(104, 100, 140), anchor='ma')

    exif = Image.Exif()
    exif[0x9286] = 'ficha-dibujada'      # UserComment: marca para reconocerlas
    im.save(destino, 'WEBP', quality=85, method=5, exif=exif.tobytes())


def main():
    cat = json.load(open(os.path.join(DATOS, 'catalogo.json'), encoding='utf-8'))
    rescate = {}
    ruta_r = os.path.join(AQUI, 'imagenes-rescatadas.json')
    if os.path.exists(ruta_r):
        rescate = json.load(open(ruta_r, encoding='utf-8'))

    cartas = cat['cartas']
    sets = cat['sets']
    print(f'Cartas: {len(cartas)}  ·  rescatadas aparte: {len(rescate)}\n')

    cuenta = {'tcgdex': 0, 'rescate': 0, 'ficha': 0, 'ya': 0, 'error': 0}
    sin_foto = []          # ids que acaban con ficha dibujada
    bytes_tot = [0]

    def una(carta):
        cid = carta['id']
        seguro = cid.replace('/', '_')
        chico = os.path.join(CARTAS, seguro + '.webp')
        grande = os.path.join(GRANDES, seguro + '.webp')

        if not REHACER and os.path.exists(chico) and os.path.exists(grande):
            # las fichas dibujadas se reconocen por su marca en el fichero
            if es_ficha_dibujada(chico):
                sin_foto.append(cid)
            cuenta['ya'] += 1
            bytes_tot[0] += os.path.getsize(chico) + os.path.getsize(grande)
            return (cid, 'ya')

        # 1 · TCGdex, la fuente principal. La ruta debe ser la de origen
        # (serie/set/numero); si no lo parece, se salta al respaldo.
        if carta.get('img') and '/' in carta['img']:
            base = f"{ASSETS}/{carta['img']}"
            d_chico = baja(base + '/low.webp')
            d_grande = baja(base + '/high.webp') or d_chico
            if d_chico:
                bytes_tot[0] += guarda(d_chico, chico, ANCHO_CHICO)
                bytes_tot[0] += guarda(d_grande, grande, ANCHO_GRANDE)
                cuenta['tcgdex'] += 1
                return (cid, 'tcgdex')

        # 2 · rescate verificado (número y nombre coincidían)
        if cid in rescate:
            d = baja(rescate[cid])
            if d:
                bytes_tot[0] += guarda(d, chico, ANCHO_CHICO)
                bytes_tot[0] += guarda(d, grande, ANCHO_GRANDE)
                cuenta['rescate'] += 1
                return (cid, 'rescate')

        # 3 · ficha dibujada (y se deja constancia)
        sin_foto.append(cid)
        ficha_dibujada(carta, sets, chico, ANCHO_CHICO)
        ficha_dibujada(carta, sets, grande, ANCHO_GRANDE)
        bytes_tot[0] += os.path.getsize(chico) + os.path.getsize(grande)
        cuenta['ficha'] += 1
        return (cid, 'ficha')

    hechas = 0
    with ThreadPoolExecutor(8) as ex:
        for _ in ex.map(una, cartas):
            hechas += 1
            if hechas % 25 == 0 or hechas == len(cartas):
                sys.stdout.write(f'\r  {hechas}/{len(cartas)}')
                sys.stdout.flush()
    print('\n')

    # ---- logos de set ----
    # El símbolo impreso no está disponible como imagen en la fuente,
    # pero el logo sí, y en una cabecera se lee mejor. Pesan ~12 KB.
    SETS_DIR = os.path.join(DATOS, 'sets')
    os.makedirs(SETS_DIR, exist_ok=True)
    pendientes = [(sid, s.get('logo')) for sid, s in sets.items() if s.get('logo')]
    hechos = 0

    def un_set(par):
        sid, url = par
        destino = os.path.join(SETS_DIR, sid.replace('/', '_') + '.webp')
        if not REHACER and os.path.exists(destino):
            return True
        for suf in ('.webp', '.png'):
            d = baja(url + suf)
            if d:
                try:
                    guarda(d, destino, 200)
                    return True
                except Exception:
                    pass
        return False

    with ThreadPoolExecutor(8) as ex:
        hechos = sum(1 for ok in ex.map(un_set, pendientes) if ok)
    print(f'Logos de set     {hechos} de {len(pendientes)}')

    # Fotos de cartas que ya no están en el catálogo (una colección que
    # resultó no ser de cartón, un Pokémon que se quitó de objetivos.json):
    # se borran para que el repositorio no cargue con lo que nadie ve.
    vivos = {c['id'] for c in cartas}
    sobras = 0
    for carpeta in (os.path.join(DATOS, 'cartas'), os.path.join(DATOS, 'cartas', 'g')):
        for f in os.listdir(carpeta):
            if f.endswith('.webp') and f[:-5] not in vivos:
                os.remove(os.path.join(carpeta, f))
                sobras += 1
    if sobras:
        print(f'Fotos huérfanas  {sobras} borradas')

    # El catálogo se limpia de enlaces externos: los ficheros ya están aquí
    for s in sets.values():
        s.pop('logo', None)
        s.pop('sim', None)
    json.dump(cat, open(os.path.join(DATOS, 'catalogo.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))

    # Las cartas NO se modifican. El fichero de cada carta se llama como
    # su id, así que la app deduce la ruta sola y este script se puede
    # volver a ejecutar mil veces sin estropear nada.

    sin_foto = sorted(set(sin_foto))
    json.dump(sin_foto, open(os.path.join(AQUI, 'sin-foto.json'), 'w', encoding='utf-8'), indent=1)
    print('─' * 52)
    print(f"SIN FOTO (fichas dibujadas en disco): {len(sin_foto)}")
    for cid in sin_foto:
        c = next((x for x in cartas if x['id'] == cid), None)
        if c: print(f"   · {cid:<18} {c['n']:<26} {sets.get(c['s'], {}).get('n', '')}")
    print(f"De TCGdex        {cuenta['tcgdex']}")
    print(f"Rescatadas       {cuenta['rescate']}")
    print(f"Ficha dibujada   {cuenta['ficha']}")
    if cuenta['ya']:
        print(f"Ya estaban       {cuenta['ya']}")
    print(f"Peso en disco    {bytes_tot[0] / 1024 / 1024:.1f} MB")
    print('─' * 52)


if __name__ == '__main__':
    main()
