#!/usr/bin/env bash
set -euo pipefail

echo "[1/3] Installing dependencies..."
npm ci --no-audit --no-fund || npm install

echo
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

VERSION_SUFFIX=""
if [ -n "${VNDB_GUI_VERSION:-}" ]; then
  VERSION_SUFFIX="-${VNDB_GUI_VERSION}"
fi
mkdir -p release

echo "[2/3] Building release..."
npm run tauri build

echo "[3/3] Copying portable binary to release..."
BIN=""
if [ -f "src-tauri/target/release/bundle/app/vndb-gui" ]; then
  BIN="src-tauri/target/release/bundle/app/vndb-gui"
elif [ -f "src-tauri/target/release/vndb-gui" ]; then
  BIN="src-tauri/target/release/vndb-gui"
else
  echo "ERROR: Binary not found." >&2
  exit 1
fi
cp "$BIN" "release/VNDB-GUI${VERSION_SUFFIX}"

echo
echo "========================================================"
echo "SUCCESS! Built: release/VNDB-GUI${VERSION_SUFFIX}"
echo "========================================================"
