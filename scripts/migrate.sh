#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APPDATA_DIR="$HOME/.code-container"
CONFIGS_DIR="$APPDATA_DIR/configs"

echo "Migrating configuration files to ~/.code-container..."
echo ""

mkdir -p "$CONFIGS_DIR"
chmod 700 "$APPDATA_DIR"
chmod 700 "$CONFIGS_DIR"

migrate_dir() {
  local src="$1"
  local dest="$2"
  local name="$3"

  if [ -d "$src" ]; then
    cp -R "$src" "$dest/"
    chmod 700 "$dest/$(basename "$src")"
    echo "  ✓ $name -> $dest/$(basename "$src")"
  else
    echo "  - $name not found, skipping"
  fi
}

migrate_file() {
  local src="$1"
  local dest="$2"
  local name="$3"

  if [ -f "$src" ]; then
    cp "$src" "$dest"
    chmod 600 "$dest"
    echo "  ✓ $name -> $dest"
  else
    echo "  - $name not found, skipping"
  fi
}

echo "Checking for config files in $SCRIPT_DIR..."
echo ""

migrate_dir "$SCRIPT_DIR/.claude" "$CONFIGS_DIR" ".claude/"
migrate_dir "$SCRIPT_DIR/.codex" "$CONFIGS_DIR" ".codex/"
migrate_dir "$SCRIPT_DIR/.gemini" "$CONFIGS_DIR" ".gemini/"
migrate_dir "$SCRIPT_DIR/.opencode" "$CONFIGS_DIR" ".opencode/"
migrate_dir "$SCRIPT_DIR/.local" "$CONFIGS_DIR" ".local/"
migrate_file "$SCRIPT_DIR/container.claude.json" "$CONFIGS_DIR/.claude.json" "container.claude.json"

echo ""
echo "Migration complete!"
echo "Config files are now stored in: $CONFIGS_DIR"
