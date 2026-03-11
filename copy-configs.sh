#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

[ -d ~/.config/opencode ] && cp -R ~/.config/opencode/ "$SCRIPT_DIR/.opencode/"
[ -d ~/.codex ] && cp -R ~/.codex/ "$SCRIPT_DIR/.codex/"
[ -d ~/.gemini ] && cp -R ~/.gemini/ "$SCRIPT_DIR/.gemini/"
[ -d ~/.claude ] && cp -R ~/.claude/ "$SCRIPT_DIR/.claude/"
[ -f ~/.claude.json ] && cp ~/.claude.json "$SCRIPT_DIR/container.claude.json"
