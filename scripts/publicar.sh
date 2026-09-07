#!/usr/bin/env bash
# Pokémon Libre · regenerar, comprobar y dejar listo para publicar.
# Cada paso corta la cadena si falla: no se publica nada a medias.
set -e
export PYTHONIOENCODING=utf-8
cd "$(dirname "$0")/.."
echo "=== 1 · catálogo ==============================================="
node scripts/catalogo.mjs
echo "=== 2 · imágenes =============================================="
python scripts/bajar-imagenes.py
echo "=== 3 · pruebas ==============================================="
node --test tests/dominio.test.js 2>&1 | tail -25
echo "=== 4 · enlaces ==============================================="
python scripts/verificar-enlaces.py
echo "=== 5 · versión ==============================================="
node scripts/version.mjs
echo "todo en orden"
