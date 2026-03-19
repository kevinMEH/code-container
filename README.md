# Code Container

Isolated container environment for autonomous coding harnesses (Claude Code, OpenCode, Codex, Gemini).

> Inspired by [kevinMEH/code-container](https://github.com/kevinMEH/code-container). Extended significantly for rootless Podman, hardware authentication (YubiKey, 1Password), seamless Claude Code auth, and alternative AI providers.

## What's Different From Upstream

The original project runs containers as root via Docker and uses NVM for Node.js. This fork needed:

- **Podman (rootless) support** — prefers Podman, falls back to Docker; uses `--userns=keep-id` so file ownership works correctly without running as root
- **Host username in container** — the container user matches your host username (build-time `ARG`), with home at `/container/$USER` to distinguish container sessions from host sessions
- **Seamless Claude Code auth** — mounts `/etc/machine-id`, `~/.claude/`, and `~/.claude.json` so Claude Code sees the same machine identity and credentials as the host; no re-authentication needed
- **Hardware auth passthrough** — 1Password SSH agent socket, GPG agent socket (for YubiKey SSH), GPG config, and YubiKey USB device passthrough
- **mise instead of NVM** — manages Node, Python, pnpm, ripgrep, fd, and all CLI tools from a single config; installed tools include opencode, codex, gemini-cli, beads, gastown
- **`--claude` / `--zai` flags** — launch directly into Claude Code (YOLO mode) or Claude with a Z.AI/GLM endpoint
- **Non-blocking exit** — container stop runs in the background so your terminal returns immediately
- **`--network host`** — simpler networking, especially useful for local dev servers
- **XDG-aware git config** — checks `~/.config/git` before `~/.gitconfig`

## Overview

- **Project isolation** — one container per project; destructive actions stay contained
- **State persistence** — installed packages, file changes, and databases persist per container
- **Shared resources** — npm/pip caches and Claude history shared across all projects
- **Auth transparency** — same credentials and machine identity as your host; no login prompts

## Prerequisites

- **Podman** (preferred) or **Docker**
- **Linux** — tested on Manjaro; should work on any systemd distro. macOS/WSL untested.

## Setup

> [!Tip]
> Don't want to setup manually? Ask your harness to set up for you:
> ```
> Help me setup `container`.
> ```

### 1. Install as Global Command

```bash
ln -s "$(pwd)/container.sh" /usr/local/bin/container
```

### 2. Configure Harnesses

```bash
./copy-configs.sh
```

Or manually:
```bash
cp -R ~/.config/opencode/ ./.opencode/
cp -R ~/.codex/ ./.codex/
```

### 3. Build Image

```bash
container --build
```

The image is built with your host username baked in (`--build-arg USERNAME=$USER`). **Rebuild if your username changes or you update the Dockerfile.**

**Includes**: Ubuntu 24.04, Node 22, Python 3, pnpm, Claude Code, OpenCode, Codex CLI, Gemini CLI, ripgrep, fd, beads, gastown.

## Usage

```bash
cd /path/to/project
container                    # Enter container shell
container --claude           # Enter directly into Claude Code (YOLO mode)
container --zai              # Enter Claude with Z.AI/GLM models
```

Inside the container:
```bash
claude                       # Claude Code (already authenticated)
opencode                     # OpenCode
codex                        # OpenAI Codex
npm install <package>        # Persists per container
pip install <package>        # Persists per container
exit                         # Stops container if last session
```

Session state is saved. Resuming a container picks up exactly where you left off.

## Common Commands

```bash
container                    # Enter container (current directory)
container /path/to/project   # Enter container for a specific project
container --build            # Rebuild image (e.g. after Dockerfile changes)
container --list             # List all containers
container --stop             # Stop current project's container
container --remove           # Remove current project's container
container --clean            # Remove all stopped containers
```

## Z.AI / GLM Models

Create `~/.zai.json` on your host:
```json
{
  "apiUrl": "https://your-endpoint",
  "apiKey": "your-key",
  "haikuModel": "glm-4.5-air",
  "sonnetModel": "glm-5.0",
  "opusModel": "glm-5.0"
}
```

Then: `container --zai`

## What Persists

**Per-container:**
- Installed packages, file changes, databases, shell history

**Shared across all projects:**
- Claude Code config, credentials, and conversation history (`~/.claude/`)
- npm and pip download caches

**Read-only from host:**
- SSH keys, git config, GPG keys

## Customization

**Add packages** — edit `Dockerfile` and rebuild:
```dockerfile
RUN apt-get update && apt-get install -y postgresql-client
```

**Add mount points** — edit `start_new_container()` in `container.sh`:
```bash
-v "$HOME/.config/something:/container/$USER/.config/something:ro"
```

No rebuild needed for mount changes; just remove and relaunch the container.

## Security

- Containers run rootless (`--userns=keep-id`) — no host root access
- SSH keys and git config mounted read-only
- Project isolation prevents cross-contamination
- Host filesystem access limited to explicitly mounted directories

**Limitations:**
- Network access is unrestricted (`--network host`); data can still be exfiltrated
- Project files can be deleted by the harness; use version control
