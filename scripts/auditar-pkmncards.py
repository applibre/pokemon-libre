# -*- coding: utf-8 -*-
"""
Pokémon Libre · auditar el catálogo contra pkmncards

pkmncards es una base de datos de cartas SOLO en inglés y bien mantenida.
Se le pide, por Pokémon, la lista completa (`pokemon:pikachu`) y se compara
con la nuestra por número de carta. Lo que aparece allí y no aquí queda
apuntado para revisarlo a mano: puede ser una carta que falta de verdad o
una impresión que ellos separan y TCGdex no.

    python scripts/auditar-pkmncards.py

Escribe scripts/.cache/auditoria-pkmncards.json
"""

import json
import os
import re
import time
import urllib.parse
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 (PokemonLibre; coleccion personal)'}


def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45).read().decode('utf-8', 'ignore')


def numero(t):
    """«018» y «18» son el mismo número; «H09» y «h9», también."""
    return re.sub(r'^([a-z]*)0+(?=\d)', r'', str(t).lower().strip())


def suyas(nombre):
    """Todas las cartas de ese Pokémon en pkmncards. Solo las direcciones
       que empiezan por su nombre: la página enlaza también cartas
       relacionadas y esas no cuentan."""
    raiz = nombre.lower().replace(' ', '-')
    vistas = []
    for pag in range(1, 10):
        base = 'https://pkmncards.com/' if pag == 1 else f'https://pkmncards.com/page/{pag}/'
        try:
            h = get(base + '?s=' + urllib.parse.quote('pokemon:' + raiz))
        except Exception:
            break
        crudas = re.findall(r'https://pkmncards\.com/card/([a-z0-9\-]+)/', h)
        # solo las de este Pokémon: la página enlaza además cartas sueltas
        # relacionadas, y esas falsearían tanto la cuenta como el final
        propias = [x for x in crudas if x.startswith(raiz + '-')]
        nuevas = [x for x in propias if x not in vistas]
        vistas += nuevas
        # la paginación se decide por lo que trae la página, no por lo que
        # nos sirve: si no hay enlace a la siguiente, se acabó
        if f'/page/{pag + 1}/' not in h:
            break
        time.sleep(0.4)
    # el número va al final de la dirección: charmander-burning-shadows-bus-18a
    salida = []
    for s in vistas:
        m = re.search(r'-([a-z]{0,4}\d+[a-z]?)$', s)
        if m:
            salida.append({'slug': s, 'num': numero(m.group(1))})
    return salida


def main():
    cat = json.load(open(os.path.join(RAIZ, 'data', 'catalogo.json'), encoding='utf-8'))
    objetivos = json.load(open(os.path.join(AQUI, 'objetivos.json'), encoding='utf-8'))
    pokemon = objetivos['principales'] + objetivos['familias']

    informe = {}
    print(f"{'Pokémon':<12} {'aquí':>6} {'allí':>6}   sin pareja")
    for p in pokemon:
        nuestras = [c for c in cat['cartas'] if p['id'] in c['p']]
        mios = {numero(c['num']) for c in nuestras}
        # solo las direcciones que empiezan por el nombre del Pokémon
        allí = suyas(p['nombre'])
        sueltas = [x for x in allí if x['num'] not in mios]
        informe[p['id']] = {'aqui': len(nuestras), 'alli': len(allí), 'sueltas': sueltas}
        print(f"{p['nombre']:<12} {len(nuestras):>6} {len(allí):>6}   {len(sueltas)}")
        for x in sueltas:
            print('      ·', x['slug'])
        time.sleep(0.5)

    os.makedirs(os.path.join(AQUI, '.cache'), exist_ok=True)
    json.dump(informe, open(os.path.join(AQUI, '.cache', 'auditoria-pkmncards.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    total = sum(len(v['sueltas']) for v in informe.values())
    print('\n' + '─' * 52)
    print(f'Cartas que aparecen en pkmncards y no aquí: {total}')


if __name__ == '__main__':
    main()
