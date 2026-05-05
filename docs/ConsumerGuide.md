# Code Container (`container`)

Repo: https://github.com/kevinMEH/code-container

This file contains instructions for AI coding assistants on how to setup and customize `container` on behalf of users.

Note: You are not allowed to run the `container` command as it will bring up an interactive Docker shell; you will thus get stuck as you won't be able to exit the shell. It is meant for user consumption only.

## Setup Instructions

If the user asks you to setup `container`, follow the following steps.

Pre-setup:

- Read `./README.md`

Setup: Do for the user, one step at a time.

1. Install `container` as NPM package:
   ```bash
   npm install -g code-container
   ```
2. After run, `container init` to copy the user's harness configs over.
   ```bash
   container init
   ```
3. Setup is done. Now, read the Dockerfiles in `resources/` and the user's `~/.code-container/Dockerfile.Packages` and `~/.code-container/Dockerfile.User` if they exist. Provide a brief list of included packages to the user. Then, ask user if they would like to add more packages into container environment. If yes, see `Add Packages/Dependencies` section below.
4. Build the Docker image for the user. Before you build, tell the user that building the image may take up to 5 minutes.
   ```bash
   container build
   ```

Post-setup:

1. Provide instructions on how to use container:
   ```
   cd /path/to/project
   container
   opencode # OR: codex OR: claude
   ```
2. Give users a quick overview of common commands.
   ```bash
   container                  # Enter the container
   container build            # Build Docker image (all stages)
   container build packages   # Rebuild from Packages stage
   container build harness    # Rebuild from Harness stage
   container build user       # Rebuild User stage only
   container init             # Copy/recopy config files
   container list             # List all containers
   container stop             # Stop current project's container
   container remove           # Remove current project's container
   container clean            # Remove all stopped containers
   ```
3. Ask users if they would like to customize local harness permissions to disable permission prompts. If yes, see `Harness Permissions` below.

## Storage Structure

All container data is stored in `~/.code-container/`:

```
~/.code-container/
├── configs/              # Harness configs (mounted to containers)
│   ├── .claude/
│   ├── .claude.json
│   ├── .codex/
│   ├── .copilot/
│   ├── .gemini/
│   ├── .local/
│   │   ├── share/
│   │   └── state/
│   └── .opencode/
├── Dockerfile.Packages   # User packages and build tools
├── Dockerfile.User       # User customizations
├── MOUNTS.txt            # Additional mount points
├── DOCKER_FLAGS.txt      # Docker flags for both run and exec
├── DOCKER_RUN_FLAGS.txt  # Docker flags for run only
└── settings.json         # Internal settings
```

## Build Stages

The Docker image is built in 4 sequential stages. Each stage builds on the previous one, producing a cached intermediate image. This lets you rebuild only the stages you need.
`code-container-core` -> `code-container-packages` -> `code-container-base` -> `code-container`

1. `Dockerfile.Core` (packaged) — Ubuntu 24.04 + system deps + Node/NVM + Python + shell config. Lengthly build, rarely changes; no need to rebuild often.
2. `Dockerfile.Packages` (user-owned) — User's custom packages and build tools (e.g. `apt-get install`, language runtimes). Lengthly builds. Placed before harnesses so that updating harnesses or user tools don't trigger a reinstall.
3. `Dockerfile.Harness` (packaged) — Installs all coding harnesses: Claude Code, Opencode, Codex CLI, Gemini CLI, GitHub Copilot CLI. Rebuild when you want to update harness versions. Quick builds.
4. `Dockerfile.User` (user-owned) — Final user customizations layered on top of everything. Quick builds.

By default, `container build` rebuilds all 4 stages from scratch. For faster iteration:

- `container build packages` — rebuilds stages 2, 3, 4 (use when you add packages / want to update packages)
- `container build harness` — rebuilds stages 3, 4 (use when you want to update harnesses)
- `container build user` — rebuilds stage 4 only (fastest; use when Dockerfile.User changed or to update user-level packages)

## Customization

### Add Packages/Dependencies (Dockerfile.Packages and Dockerfile.User)

> **Deprecation Notice**: `~/.code-container/Dockerfile` is deprecated and no longer used. If the user previously customized this file, offer to migrate their custom `RUN` commands to `~/.code-container/Dockerfile.Packages` or `~/.code-container/Dockerfile.User`.

The build pipeline consists of 4 stages. Users can customize two of them:

1. `Dockerfile.Packages` — For large system packages and build tools (e.g. `apt-get install`, language runtimes). Placed after the base image so these are cached separately from harnesses.
2. `Dockerfile.User` — For user customizations layered on top of everything else.

Add build tools and system packages to `~/.code-container/Dockerfile.Packages`:

```dockerfile
FROM code-container-core:latest

# System packages (Ubuntu/Debian)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools

# Additional language runtimes or build tools
RUN apt-get update && apt-get install -y golang-go
```

Add user-level tools and customizations to `~/.code-container/Dockerfile.User`:

```dockerfile
FROM code-container-base:latest

# Global npm packages
RUN npm install -g bun typescript

# Global pip packages
RUN pip install requests

# Other misc commands
RUN npx opencode plugin opencode-quotes-plugin -g
```

**After modifying either file:**

- Run `container build packages` to rebuild from the Packages stage (faster if only Dockerfile.Packages changed)
- Run `container build user` to rebuild from the User stage only (fastest if only Dockerfile.User changed)
- Run `container build` to rebuild everything from scratch

### Add Mount Points (MOUNTS.txt)

Add shared volumes by editing `~/.code-container/MOUNTS.txt`:

```
# Shared directory (persists across containers, readable, writable)
/absolute/path/on/host:/root/target-path

# Read-only mount from host
/absolute/path/on/host:/root/target-path:ro
```

**After modifying:** No rebuild needed. However, mounts will only be applied to new containers. Inform users that old containers may have to be `container remove` and restarted.

### Add Docker Flags (DOCKER_FLAGS.txt)

Add custom Docker flags by editing `~/.code-container/DOCKER_FLAGS.txt`:

```
# Port forwarding
-p 4040:4040
-p 3000:3000

# Network mode
--network host

# GPU support
--gpus all


```

Each line is parsed like a shell command. Empty lines and lines starting with `#` are ignored.

**After modifying:** No rebuild needed. However, flags will only be applied to new containers. Inform users that old containers may have to be `container remove` and restarted.

## Harness Permissions

If the user asks you to configure harnesses to run without permission prompts inside `container`, read and follow instructions in [Permissions.md](/docs/Permissions.md).

Note: Modify the configuration files inside `~/.code-container/configs` only.
