#!/bin/bash
# Code Container uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/drmikecrowe/code-container/main/uninstall.sh | bash
#
# What this script does (nothing hidden):
#   1. Removes the "container" symlink from PATH
#   2. Removes the cloned repo from ~/.local/share/code-container
#   3. Optionally removes all stopped code-* containers and the container image

set -euo pipefail

INSTALL_DIR="$HOME/.local/share/code-container"
BINARY_NAME="container"

# --- Helpers ---

info()  { echo -e "\033[0;34m==>\033[0m $1"; }
ok()    { echo -e "\033[0;32m==>\033[0m $1"; }
warn()  { echo -e "\033[1;33m==>\033[0m $1"; }
err()   { echo -e "\033[0;31m==>\033[0m $1" >&2; }

# --- Step 1: Remove symlink ---

LINK_REMOVED=false

for dir in "$HOME/.local/bin" "/usr/local/bin"; do
    link="$dir/$BINARY_NAME"
    if [ -L "$link" ]; then
        target=$(readlink "$link")
        if [[ "$target" == *code-container/container.sh ]]; then
            info "Removing symlink $link -> $target"
            if [ "$dir" = "/usr/local/bin" ]; then
                sudo rm "$link"
            else
                rm "$link"
            fi
            ok "Symlink removed"
            LINK_REMOVED=true
        fi
    fi
done

if [ "$LINK_REMOVED" = "false" ]; then
    warn "No container symlink found on PATH"
fi

# --- Step 2: Remove cloned repo ---

if [ -d "$INSTALL_DIR" ]; then
    info "Removing $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
    ok "Installation directory removed"
else
    warn "$INSTALL_DIR not found — already removed?"
fi

# --- Step 3: Optionally clean up containers and image ---

RUNTIME=""
if command -v podman >/dev/null 2>&1; then
    RUNTIME="podman"
elif command -v docker >/dev/null 2>&1; then
    RUNTIME="docker"
fi

if [ -n "$RUNTIME" ]; then
    containers=$($RUNTIME ps -a --filter "name=code-" --quiet 2>/dev/null || true)
    image_exists=$($RUNTIME image inspect "code:latest" >/dev/null 2>&1 && echo yes || echo no)

    if [ -n "$containers" ] || [ "$image_exists" = "yes" ]; then
        echo ""
        read -r -p "Also remove all code-* containers and the code:latest image? [y/N] " reply
        if [[ "${reply:-N}" =~ ^[Yy]$ ]]; then
            if [ -n "$containers" ]; then
                info "Stopping and removing code-* containers"
                $RUNTIME rm -f $containers
                ok "Containers removed"
            fi
            if [ "$image_exists" = "yes" ]; then
                info "Removing code:latest image"
                $RUNTIME rmi "code:latest"
                ok "Image removed"
            fi
        else
            info "Leaving containers and image in place"
        fi
    fi
fi

echo ""
ok "Code Container uninstalled"
