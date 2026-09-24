#!/usr/bin/env bash
# Regénère le PDF du rapport réflexion IA (nécessite pandoc + xelatex + DejaVu Sans).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
pandoc RAPPORT_REFLEXION_IA_NOVADESIC.md -o RAPPORT_REFLEXION_IA_NOVADESIC.pdf \
  --pdf-engine=xelatex \
  -f markdown+raw_tex
echo "OK : $DIR/RAPPORT_REFLEXION_IA_NOVADESIC.pdf"
