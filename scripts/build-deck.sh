#!/usr/bin/env bash
# Convert a Marp markdown into the report-render format and render the slides PDF.
#   - rendered markdown is written next to the source (so relative image paths resolve)
#   - PDF is written to output/
#
# Usage:  scripts/build-deck.sh <marp-source.md>
#         scripts/build-deck.sh                       # defaults to presentation/present-milvus-original.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${1:-presentation/present-milvus-original.md}"
# Strip a leading '@' (Claude Code file-mention prefix) if the user supplied one
SOURCE="${SOURCE#@}"

if [ ! -f "$SOURCE" ]; then
  echo "✗ Source markdown not found: $SOURCE" >&2
  exit 1
fi

mkdir -p output

BASE="$(basename "$SOURCE" .md)"
# Both artifacts go into output/. The converter rewrites relative image paths
# to absolute paths so the rendered markdown still finds its images from here.
RENDERED_MD="output/${BASE}.rendered.md"
OUT_PDF="output/${BASE}.pdf"

PY="${PY:-.venv/bin/python3}"
[ -x "$PY" ] || PY="python3"

"$PY" scripts/convert-marp-to-render.py "$SOURCE" "$RENDERED_MD"
node .claude/skills/report-render/render.js "$RENDERED_MD" --format=slides -o "$OUT_PDF"

echo "→ markdown: $RENDERED_MD"
echo "→ pdf:      $OUT_PDF"
[ "${OPEN:-1}" = "1" ] && open "$OUT_PDF" || true
