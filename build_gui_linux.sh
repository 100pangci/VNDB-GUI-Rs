#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# --- Node version check: Vite 6 requires Node >= 18 ---------------------------
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  TOOLCHAIN_DIR="$ROOT_DIR/.toolchain"
  NODE_DIR="$TOOLCHAIN_DIR/node20"
  NODE_BIN="$NODE_DIR/bin"
  if [ ! -x "$NODE_BIN/node" ]; then
    echo "[0/3] System Node $NODE_MAJOR too old (need >=18), downloading Node 20 LTS..."
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64) NODE_ARCH="x64" ;;
      aarch64) NODE_ARCH="arm64" ;;
      *) echo "ERROR: Unsupported architecture: $ARCH" >&2; exit 1 ;;
    esac
    NODE_VERSION="v20.19.4"
    TARBALL="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
    URL="https://nodejs.org/dist/$NODE_VERSION/$TARBALL"
    mkdir -p "$TOOLCHAIN_DIR"
    curl -fL --retry 3 -o "$TOOLCHAIN_DIR/$TARBALL" "$URL"
    tar -xJf "$TOOLCHAIN_DIR/$TARBALL" -C "$TOOLCHAIN_DIR"
    mv "$TOOLCHAIN_DIR/node-$NODE_VERSION-linux-$NODE_ARCH" "$NODE_DIR"
    rm -f "$TOOLCHAIN_DIR/$TARBALL"
  fi
  export PATH="$NODE_BIN:$PATH"
  echo "Using Node: $(node --version) at $NODE_BIN"
fi

echo "[1/3] Installing dependencies..."
npm ci --no-audit --no-fund || npm install

echo
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
