#!/usr/bin/env bash
# Pokémon Libre · buscar cartas nuevas de tus 17 Pokémon.
#   bash scripts/buscar-novedades.sh
# Solo AÑADE: lo que ya estaba en el catálogo queda idéntico. Sale con
#   0  hay novedades válidas (scripts/.cache/resumen.md dice cuáles)
#   3  no hay nada nuevo
#   1  algo no cuadra: no se propone nada
set -e
export PYTHONIOENCODING=utf-8
cd "$(dirname "$0")/.."
mkdir -p scripts/.cache
BASE=scripts/.cache/catalogo-publicado.json
cp data/catalogo.json "$BASE"
export CATALOGO_BASE="$BASE" NOVEDADES_SALIDA=scripts/.cache/novedades.json

echo "=== 1 · japonesas: expansiones nuevas y las más recientes otra vez ==="
python scripts/japonesas.py sets
JP_RECIENTES=8 python scripts/japonesas.py cartas
python scripts/japonesas.py fichas
python scripts/japonesas.py detalles

echo "=== 2 · inglesas: las listas por Pokémon y por set se piden de nuevo ==="
rm -f scripts/.cache/dex-*.json scripts/.cache/set-*.json scripts/.cache/sets-lista.json
node scripts/catalogo.mjs | tail -22

echo "=== 3 · enlaces de TCG Collector para las inglesas nuevas ==="
python scripts/tcgcollector.py | tail -6
node scripts/catalogo.mjs | grep -E "Solo añadir|^Cartas|^Sets"

echo "=== 4 · imágenes de las nuevas ==="
python scripts/bajar-imagenes.py | tail -8

echo "=== 5 · ¿qué entra? ==="
set +e
node scripts/comprobar-novedades.mjs "$BASE"
salida=$?
set -e
if [ "$salida" -eq 0 ]; then
  echo "=== 6 · pruebas del catálogo ==="
  node --test tests/dominio.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"
  node --test tests/dominio.test.js >/dev/null 2>&1
fi
exit $salida
