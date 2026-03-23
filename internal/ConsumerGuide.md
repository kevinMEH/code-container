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
3. Setup is done. Now, read `~/.code-container/Dockerfile`, which is the default packaged Dockerfile. Provide a brief list of included packages to the user. Then, ask user if they would like to add more packages into container environment. If yes, see `Add Packages/Dependencies` section below.
4. Build the Docker image for the user. Before you build, tell the user that building the image may take up to 5 minutes.
   ```bash
   container build
   ```

Post-setup:
1. Provide instructions on how to use container:
   ```
   cd /path/to/project
   container
   opencode # OR: codex OR: claude OR: gh copilot
   ```
2. Give users a quick overview of common commands.
   ```bash
   container                  # Enter the container
   container build            # Build Docker image
   container init             # Copy/recopy config files
   container list             # List all containers
   container stop             # Stop current project's container
   container remove            # Remove current project's container
   container clean            # Remove all stopped containers
   ```
3. Ask users if they would like to customize local harness permissions to disable permission prompts. If yes, see `Harness Permissions` below.

## Storage Structure

All container data is stored in `~/.code-container/`:

```
~/.code-container/
├── configs/          # Harness configs (mounted to containers)
│   ├── .claude/
│   ├── .claude.json
│   ├── .codex/
│   ├── .gemini/
│   ├── .gh/
│   ├── .local/
│   └── .opencode/
├── Dockerfile        # Custom Dockerfile
├── MOUNTS.txt        # Additional mount points
├── DOCKER_FLAGS.txt  # Additional docker run flags
└── settings.json     # Internal settings
```

## Customization

### Add Packages/Dependencies (Dockerfile)

Add new tools by extending the RUN commands in `~/.code-container/Dockerfile`:

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
- Run `container build` to rebuild.

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

If the user asks you to configure harnesses to run without permission prompts inside `container`, read and follow instructions in [Permissions.md](/Permissions.md).

Note: Modify the configuration files inside `~/.code-container/configs` only.
