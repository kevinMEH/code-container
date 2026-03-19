#!/bin/bash
# Code Container installer
# Usage: curl -fsSL https://raw.githubusercontent.com/drmikecrowe/code-container/main/install.sh | bash
#
# What this script does (nothing hidden):
#   1. Clones the repo to ~/.local/share/code-container (or pulls if already present)
#   2. Symlinks container.sh as "container" into a directory on your PATH
#      - Prefers ~/.local/bin if it's on your PATH (no sudo needed)
#      - Falls back to /usr/local/bin via sudo

set -euo pipefail

REPO_URL="https://github.com/drmikecrowe/code-container.git"
INSTALL_DIR="$HOME/.local/share/code-container"
BINARY_NAME="container"

# --- Helpers ---

info()  { echo -e "\033[0;34m==>\033[0m $1"; }
ok()    { echo -e "\033[0;32m==>\033[0m $1"; }
warn()  { echo -e "\033[1;33m==>\033[0m $1"; }
err()   { echo -e "\033[0;31m==>\033[0m $1" >&2; }

# --- Pre-flight checks ---

if ! command -v git >/dev/null 2>&1; then
    err "git is required but not found. Please install git first."
    exit 1
fi

if ! command -v podman >/dev/null 2>&1 && ! command -v docker >/dev/null 2>&1; then
    warn "Neither podman nor docker found. You'll need one before running container."
fi

# --- Step 1: Clone or update the repo ---

if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing installation at $INSTALL_DIR"
    git -C "$INSTALL_DIR" pull --ff-only origin main
    ok "Updated to latest"
else
    info "Cloning $REPO_URL -> $INSTALL_DIR"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Cloned successfully"
fi

chmod +x "$INSTALL_DIR/container.sh"

# --- Step 2: Symlink into PATH ---

SOURCE="$INSTALL_DIR/container.sh"
LINK_TARGET=""

# Prefer ~/.local/bin if it's on PATH
if echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
    LINK_DIR="$HOME/.local/bin"
    mkdir -p "$LINK_DIR"
    LINK_TARGET="$LINK_DIR/$BINARY_NAME"

    if [ -L "$LINK_TARGET" ] || [ -e "$LINK_TARGET" ]; then
        info "Removing existing $LINK_TARGET"
        rm "$LINK_TARGET"
    fi

    info "Symlinking $SOURCE -> $LINK_TARGET"
    ln -s "$SOURCE" "$LINK_TARGET"
    ok "Installed to $LINK_TARGET (no sudo needed)"
else
    LINK_DIR="/usr/local/bin"
    LINK_TARGET="$LINK_DIR/$BINARY_NAME"

    warn "~/.local/bin is not on your PATH; falling back to $LINK_DIR (requires sudo)"

    if [ -L "$LINK_TARGET" ] || [ -e "$LINK_TARGET" ]; then
        info "Removing existing $LINK_TARGET"
        sudo rm "$LINK_TARGET"
    fi

    info "Symlinking $SOURCE -> $LINK_TARGET (via sudo)"
    sudo ln -s "$SOURCE" "$LINK_TARGET"
    ok "Installed to $LINK_TARGET"
fi

# --- Step 3: Verify ---

if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    ok "Done! Run 'container --build' to build the image, then 'container' in any project directory."
else
    warn "Installed, but '$BINARY_NAME' isn't found on PATH. You may need to restart your shell."
fi
