# Code Container (`container`)

Repo: https://github.com/kevinMEH/code-container

This file contains instructions for AI coding assistants on how to setup and customize `container` for users.

Note: You are not allowed to run the `container` command as it will bring up an interactive shell inside the container. It is meant for user consumption only.

## Setup Instructions

If the user asks you to setup `container`, follow the following steps.

Pre-setup:
- Read `./Dockerfile`
- Read `./container.sh`

Setup: Do one step at a time. Do not overload the user with instructions.
1. Ask user to do this step: Install `container` as global command:
   ```bash
   ln -s "$(pwd)/container.sh" /usr/local/bin/container
   ```
   Do not ask user to run with `sudo`. If insufficient permissions, find an alternative location on user's `$PATH` to link to.
2. Do for user: Copy harness configs:
   ```bash
   ./copy-configs.sh
   ```
3. Do for user: Provide a list of included packages in `Dockerfile`. Then, ask user if they would like to add more packages into container environment. If yes, see `Add Packages/Dependencies` section below.
4. Do for user: Build Docker image:
   ```bash
   container --build
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
  container
  container --build          # Rebuild Docker image
  container --list           # List all containers
  container --stop           # Stop current container
  container --remove         # Remove current container
  container --clean          # Remove all stopped containers
  ```
3. Ask users if they would like to customize local harness permissions to disable permission prompts. If yes, see Harness Permissions below.

## Customization

### Add Packages/Dependencies (Dockerfile)

Add new tools by extending the RUN commands in `Dockerfile`:

```dockerfile
# System packages (Ubuntu/Debian)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools

# Global npm packages
RUN npm install -g typescript

# Global pip packages
RUN pip install requests pandas
```

**After modifying:**
- Run `container --build` to rebuild.
- Run `container --remove` or `container --clean` to remove outdated containers based on the old image.

### Add Mount Points (container.sh)

Add shared volumes by modifying `start_new_container()` in `container.sh`:

```bash
# Shared directory (persists across containers)
-v "$SCRIPT_DIR/custom-dir:/root/target-path"

# Read-only mount from host
-v "$HOME/.config:/root/.config:ro"
```

**After modifying:** No rebuild needed; changes apply to new containers.

## Harness Permissions

If the user asks you to configure harnesses to run without permission prompts inside `container`, read and follow instructions in [Permissions.md](/Permissions.md).

Note: You may only modify the user's configuration files in this repository only. Do not modify the files in their home directory (`~/`).

## What Persists

**Per-container:** All installed packages, file changes, databases, shell history
**Shared:** npm/pip caches, AI harness configs/conversations, Python user packages
**Read-only:** Git config, SSH keys
