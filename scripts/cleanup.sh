#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APPDATA_DIR="$HOME/.code-container"
CONFIGS_DIR="$APPDATA_DIR/configs"

echo "Cleaning up old configuration files..."
echo ""

cleanup_dir() {
  local src="$1"
  local new_location="$2"
  local name="$3"

  if [ ! -d "$src" ]; then
    echo "  - $name not found in project root, skipping"
    return
  fi

  if [ ! -d "$new_location" ]; then
    echo "  ✗ $name exists in project root but not found in $CONFIGS_DIR"
    echo "    Run scripts/migrate.sh first to avoid data loss"
    return
  fi

  rm -rf "$src"
  echo "  ✓ Removed $name"
}

cleanup_file() {
  local src="$1"
  local new_location="$2"
  local name="$3"

  if [ ! -f "$src" ]; then
    echo "  - $name not found in project root, skipping"
    return
  fi

  if [ ! -f "$new_location" ]; then
    echo "  ✗ $name exists in project root but not found in $CONFIGS_DIR"
    echo "    Run scripts/migrate.sh first to avoid data loss"
    return
  fi

  rm -f "$src"
  echo "  ✓ Removed $name"
}

echo "Checking for old config files in $SCRIPT_DIR..."
echo ""

cleanup_dir "$SCRIPT_DIR/.claude" "$CONFIGS_DIR/.claude" ".claude/"
cleanup_dir "$SCRIPT_DIR/.codex" "$CONFIGS_DIR/.codex" ".codex/"
cleanup_dir "$SCRIPT_DIR/.gemini" "$CONFIGS_DIR/.gemini" ".gemini/"
cleanup_dir "$SCRIPT_DIR/.opencode" "$CONFIGS_DIR/.opencode" ".opencode/"
cleanup_dir "$SCRIPT_DIR/.local" "$CONFIGS_DIR/.local" ".local/"
cleanup_file "$SCRIPT_DIR/container.claude.json" "$CONFIGS_DIR/.claude.json" "container.claude.json"

echo ""
echo "Cleanup complete!"
