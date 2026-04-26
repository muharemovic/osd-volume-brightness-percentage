#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID=$(grep '"uuid"' "$SCRIPT_DIR/metadata.json" | sed 's/.*"uuid": *"\(.*\)".*/\1/')
ZIP="${SCRIPT_DIR}/${UUID}.zip"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

if [ ! -f "$ZIP" ]; then
    echo "Zip not found, building first..."
    bash "$SCRIPT_DIR/package.sh"
fi

echo "Installing ${UUID} to ${INSTALL_DIR}..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -q "$ZIP" -d "$INSTALL_DIR"

echo "Installed successfully."
echo "Enable via Extensions app."
