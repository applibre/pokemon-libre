#!/usr/bin/env bash
# Pokémon Libre · reconstruir la app y dejarla lista para publicar.
# Cada paso corta la cadena si falla: no se publica nada a medias.
# (Las novedades de cartas las trae solas .github/workflows/novedades.yml.)
set -e
export PYTHONIOENCODING=utf-8
cd "$(dirname "$0")/.."
echo "=== 1 · pruebas del catálogo ==================================="
node --test tests/dominio.test.js 2>&1 | tail -8
echo "=== 2 · construir la app en la raíz ============================"
(cd app && node construir.mjs)
echo "=== 3 · probar lo construido ==================================="
(cd app && (node pruebas/servir-prod.mjs 8410 & echo $! > .servidor.pid) && sleep 2 \
  && node pruebas/datos.mjs http://localhost:8410/pokemon-libre/ \
  && node pruebas/uso.mjs http://localhost:8410/pokemon-libre/; kill "$(cat .servidor.pid)"; rm -f .servidor.pid)
echo "todo en orden: haz commit y push"
