#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID=$(grep '"uuid"' "$SCRIPT_DIR/metadata.json" | sed 's/.*"uuid": *"\(.*\)".*/\1/')
OUT="${SCRIPT_DIR}/${UUID}.zip"

cd "$SCRIPT_DIR"

rm -f "$OUT"

zip -r "$OUT" \
    extension.js \
    prefs.js \
    metadata.json \
    metadata.json.license \
    stylesheet.css \
    modules/ \
    locale/ \
    schemas/ \
    LICENSES/

echo "Created: $OUT"
