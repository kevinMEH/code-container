# Code Container

Code Container: Isolated Docker environment for your autonomous coding harness.

## Overview

- **Project Isolation**: One container per project with complete isolation
- **State Persistence**: All changes and packages persist between sessions
- **Shared Resources**: npm cache, pip cache, and Claude history shared across projects
- **Security**: Changes within a container don't affect your host or other projects

## Prerequisites

- **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- **A POSIX-Compatible System** — Linux, macOS, WSL

## Initial Setup

### 1. Install as Global Command

To use the `container` command from anywhere, create a symlink in a PATH-tracked folder:
```bash
ln -s "$(pwd)/container.sh" /usr/local/bin/container
```

### 2. Configure Harnesses

Copy configurations into this repo (shared across all containers):
```bash
# Script to copy harness configs
./copy-configs.sh
```

Or, if copying manually:
```bash
# OpenCode
cp -R ~/.config/opencode/ ./.opencode/
# Codex
cp -R ~/.codex/ ./.codex/
# Claude Code
cp -R ~/.claude/ ./.claude/ && cp ~/.claude.json container.claude.json
```

### 3. Build Docker Image

```bash
container --build    # Run once, or when rebuilding
```

**Includes**: Ubuntu 24.04 LTS, Node.js 22 LTS, Python 3, Claude Code, OpenCode, OpenAI Codex CLI, git. Add other tools by modifying the `Dockerfile`.

## Primary Usage

Navigate to any project and run `container` to mount the project and open the container.
```bash
cd /path/to/your/project
container                    # Enter container
```

Inside the container: Start your harness and develop like normal.
```bash
opencode                     # Start OpenCode
codex                        # Start OpenAI Codex
npm install <package>        # Persists per container
pip install <package>        # Persists per container
exit                         # Auto-stops container on exit
```

Container state is saved. Next invocation resumes where you left off. AI conversations and settings persist across all projects.

### Container Isolation

Destructive actions are localized inside containers. You can let your harness run with full permissions.

To configure your harness to run without permissions, see [Permissions.md](Permissions.md) for instructions.

## Common Commands

```bash
container                  # Enter the container
container --list           # List all containers
container --stop           # Stop current project's container
container --remove         # Remove current project's container
container --build          # Rebuild Docker image

# With an explicit path:
container /path/to/project
container --stop /path/to/project
container --remove /path/to/project
```

## What Persists

**Per-Container**:
- All installed system packages, npm packages, Python packages
- All file modifications, databases, shell history
- Container filesystem state

**Shared Across All Projects:**
- Harness configuration and conversation history
- npm and pip download caches
- Python user packages

**Read-only from Host:**
- Git configuration, SSH keys

## Simultaneous Work

You and your harness can work on the same project simultaneously.

**Safe**: Reading files, editing files, most development operations

**Avoid**: Simultaneous Git operations from both sides, installing conflicting `node_modules`

**Recommended Workflow**: Let your harness run autonomously in the container while you work; review changes and commit.

## Customization

**Add tools/packages** — Edit `Dockerfile` and rebuild:
```dockerfile
RUN apt-get update && apt-get install -y postgresql-client redis-tools && rm -rf /var/lib/apt/lists/*
```

**Add shared volumes (caches, config, etc.)** — Edit the `docker run -it` command in `container.sh`:
```bash
-v "$SCRIPT_DIR/new-shared-dir:/root/target-path"
```

## Security

- SSH keys and Git config mounted read-only
- Project isolation prevents cross-contamination across containers
- Host filesystem protected (access limited to mounted directories)

**Limitations:**
- Network access still available; information may still be exfiltrated over network
- Project files can still be deleted by harness; always use upstream version control
