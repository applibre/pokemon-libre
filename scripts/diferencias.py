# -*- coding: utf-8 -*-
"""
En qué se distingue a simple vista cada variante especial de su carta normal.
Lo usa traer-variantes.py; el texto sale en la ficha de la carta («Se distingue por…»).
Una variante que no se sepa explicar aquí no entra (traer-variantes.py se detiene).
"""
import re

# (patrón en el nombre de la variante, qué sello lleva); el primero que encaja gana
SELLOS = [
    (r'Pokémon Day (\d{4})', r'el sello de Pokémon Day \1'),
    (r'Pokémon Day Stamped|^Pokémon Day$', 'el sello de Pokémon Day'),
    (r'National Championships · Staff', 'el sello del Campeonato Nacional y la palabra STAFF'),
    (r'Prerelease · Staff|^Staff$', 'el sello de Prerelease y la palabra STAFF'),
    (r'XY Evolutions Prerelease', 'el sello de presentación de XY Evolutions'),
    (r'^Prerelease$', 'el sello de Prerelease (presentación de la expansión)'),
    (r'National Championships', 'el sello del Campeonato Nacional'),
    (r'Regional Championships', 'el sello del Campeonato Regional'),
    (r'State Championship', 'el sello del Campeonato Estatal'),
    (r'City Championships', 'el sello del Campeonato de Ciudad'),
    (r'Asia Championship', 'el sello del Campeonato de Asia'),
    (r'World Championship .* Winner|^Winner$', 'el sello de los Mundiales con la palabra WINNER'),
    (r'League Challenge · (\d)\w* Place', r'el sello de League Challenge con el puesto \1.º'),
    (r'Pokémon League|League Promo', 'el sello de la Liga Pokémon'),
    (r'Gym Challenge', 'el sello de Gym Challenge'),
    (r'Prize Pack', 'el sello de Play! Pokémon (Prize Pack)'),
    (r'Battle Academy 20\d\d · n\.º (\d+) \((\w+)\)', r'el sello de Battle Academy: un \2 con el número \1'),
    (r'Battle Academy', 'el sello de Battle Academy'),
    (r'Trick or Trade · (\d{4}) Copyright', r'la calabaza de Trick or Trade (y el copyright de \1)'),
    (r'Trick or Trade', 'la calabaza de Pikachu de Trick or Trade'),
    (r'Holiday Calendar|Calendario Countdown', 'un copo de nieve (calendario de Navidad)'),
    (r'E3 Stamped', 'el sello E3'),
    (r'W Stamped', 'una W dorada (Wizards)'),
    (r'PokeTour 1999', 'el sello PokéTour 1999'),
    (r'SDCC 2005', 'el sello de la Comic-Con 2005'),
    (r'10th Anniversary', 'el sello del 10.º aniversario'),
    (r'20th Anniversary', 'el sello del 20.º aniversario'),
    (r'Stellar Crown Stamp', 'el logo de Stellar Crown'),
    (r'Vivid Voltage Stamped', 'el logo de Vivid Voltage'),
    (r'Prismatic Evolutions? Stamp', 'el logo de Prismatic Evolutions'),
    (r'Obsidian Flames Stamped', 'el logo de Obsidian Flames'),
    (r'^GYM$', 'el sello de Pokémon TCG GYM'),
    (r'JR East Stamp Rally', 'el sello de la JR East Stamp Rally (Japón)'),
    (r'Detective Pikachu Stamped|^Stamped$', 'el logo de la película Detective Pikachu'),
    (r'Rain City Showcase', 'el sello Rain City Showcase'),
    (r'Pokémon Together', 'el texto «Pokémon Together»'),
    (r'Burger King · (.+)', r'el logo de \1 (Burger King)'),
    (r'Build-[Aa]-Bear', 'el logo de Build-A-Bear Workshop'),
    (r'Toys R Us', 'el logo de Toys"R"Us'),
    (r'Best Buy', 'el logo de Pokémon 151 (Best Buy)'),
    (r'GameStop|Gamestop', 'el logo de GameStop'),
    (r'EB ?Games', 'el logo de EB Games'),
    (r'Pokémon Center', 'el sello de Pokémon Center'),
    (r'Library', 'el sello de Play! Pokémon (bibliotecas)'),
    (r'2014 Movie', 'el sello de la película de 2014'),
    # Partidarios (Entrenadores): premios de torneo y de la Liga
    (r'25th Anniversary', 'el sello del 25.º aniversario'),
    (r'^Champion', 'el sello de campeón (Champion)'),
    (r'^Finalist', 'el sello de finalista'),
    (r'^Top (\d+)', r'el sello de Top \1 de un torneo'),
    (r'Player Reward', 'el sello de premio de la Liga (Player Reward)'),
    (r'International Challenge', 'el sello del International Challenge'),
    (r'League Cup', 'el sello de la League Cup'),
    (r'Regional Championship|Regional Stamp', 'el sello del Campeonato Regional'),
    (r'Ultra Ball League', 'el sello de la Ultra Ball League'),
    (r'Gym Stamp', 'el sello de GYM (Asia)'),
    (r'^GYM$|· GYM$', 'el sello de Pokémon TCG GYM'),
    (r'^(\d{4})-(\d{4})$', r'el sello del Professor Program de la temporada \1-\2'),
]
BRILLOS = [
    (r'Reverse Cosmos', 'reverse holo con brillo Cosmos (puntos y estrellas)'),
    (r'Cosmos', 'brillo holográfico Cosmos (puntos y estrellas)'),
    (r'Cracked Ice', 'brillo holográfico de hielo quebrado (Cracked Ice)'),
    (r'Water Web', 'brillo holográfico de red de agua'),
    (r'Master Ball Pattern', 'reverse holo con Master Balls en el fondo'),
    (r'Poké Ball Pattern', 'reverse holo con Poké Balls en el fondo'),
    (r'Friend Ball', 'reverse holo con Friend Balls en el fondo'),
    (r'Dusk Ball', 'reverse holo con Dusk Balls en el fondo'),
    (r'Energy Symbol', 'reverse holo con el símbolo de energía en el fondo'),
    (r'General Mills', 'brillo holográfico de la promoción de cereales General Mills'),
    (r'Costco', 'brillo Cosmos de los packs de Costco'),
    (r'Sheen Holo', 'brillo holográfico satinado (Sheen Holo)'),
    (r'Line Holo', 'brillo holográfico de líneas'),
    (r'30th Celebration|DP Majestic Dawn', 'brillo holográfico Cosmos (puntos y estrellas)'),
]
# variantes que no son un sello ni un brillo: texto completo
OTRAS = [
    (r'Shadowless · Red Cheeks', 'Sin sombra junto al recuadro de la ilustración y con las mejillas ROJAS (las normales son amarillas).'),
    (r'Red Cheeks', 'Lleva el sello E3 y las mejillas ROJAS (las normales son amarillas).'),
    (r'^Shadowless$', 'Sin la sombra a la derecha del recuadro de la ilustración (la normal sí la tiene). '
                      'La 1.ª edición, que tampoco tiene sombra, se marca en la carta normal.'),
    (r'^Mundial$', 'Carta de un mazo de los Mundiales: banda «NOT TOURNAMENT LEGAL», borde gris, la firma de un campeón '
                   'y dorso distinto (no vale en torneo). Las de distintos años y jugadores se ven iguales: cuentan como una.'),
    (r'Mundial (\d{4}) · (.+)', r'Carta del mazo del Mundial \1 de \2: borde dorado, su firma y dorso distinto (no vale en torneo).'),
    (r'Black Dot Error', 'Error de impresión: un punto negro sobre la ilustración.'),
    (r'No Rarity Symbol', 'Error de impresión: sin el símbolo de rareza.'),
    (r'Misprint', 'Error de impresión de la promo: lleva el símbolo de 1.ª edición.'),
    (r'Metal Card', 'Carta de metal dorada (Celebrations).'),
    (r'Full Art', 'Arte completo: la ilustración ocupa toda la carta.'),
    (r'No E-Reader', 'Sin la tira de puntos del e-Reader en el borde.'),
    (r'Sin sello de la Liga', 'Sin el sello de la Liga Pokémon que lleva la promo normal (es la del mazo).'),
]


def diferencia(n):
    """«Pokémon Day 2026» → «Lleva el sello de Pokémon Day 2026.»  ·  None si no se sabe explicar."""
    for rx, t in OTRAS:
        m = re.search(rx, n)
        if m:
            return m.expand(t)
    trozos = []
    for rx, t in SELLOS:
        m = re.search(rx, n)
        if m:
            t = m.expand(t)
            if re.search(r'Staff', n) and 'STAFF' not in t:
                t += ' y la palabra STAFF'
            trozos.append('Lleva ' + t + '.')
            break
    for rx, t in BRILLOS:
        if re.search(rx, n):
            trozos.append(t[0].upper() + t[1:] + '.')
            break
    return ' '.join(trozos) or None
