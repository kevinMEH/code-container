<p align="center">
  <img src=".github/README/banner.png" alt="Banner" />
</p>

#### Code Container: Isolated Docker environment for your autonomous coding harness.

#### Simple. Lightweight. Secure.

## Quickstart

> [!Note]
> Are you still on the shell script version of `container` (container.sh)? Migrate to the NPM package by running the following:
> ```bash
> # TODO: Add install command
> bash scripts/migrate.sh     # Migrate configs over to ~/.code-container/configs
> bash scripts/cleanup.sh     # Optional: Cleanup config files
> ```

### Prerequisites

- **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- **A POSIX-Compatible System** — Linux, macOS, WSL

### Installation

1. `container` is available as a NPM package. To install, simply run:
    ```bash
    # TODO: Add install command
    ```

2. Then run the following to copy all your AI harness configs from `~/` to `~/.code-container/configs` for mounting onto the container.
    ```bash
    container init
    ```
    Alternatively, you can copy configs manually:
    - `~/.config/opencode` → `~/.code-container/configs/.opencode`
    - `~/.codex` → `~/.code-container/configs/.codex`
    - `~/.claude` → `~/.code-container/configs/.claude`
    - `~/.claude.json` → `~/.code-container/configs/.claude.json`
    - `~/.gemini` → `~/.code-container/configs/.gemini`

You're done 🎉; `container` is now ready to use.

## Usage

Navigate to any project and run `container` to mount project and enter container.
```bash
cd /path/to/your/project
container                    # Enter container
```

Inside the container: Start your harness and develop like normal.
```bash
opencode                     # Start OpenCode
npm install <package>        # Persists per container
# ...
```

Container state is saved. Next invocation resumes where you left off. AI conversations and settings persist across all projects.

### Common Commands

```bash
container                  # Enter the container
container run /path/to     # Enter container for specific project
container list             # List all containers
container stop             # Stop current project's container
container remove            # Remove current project's container
container build            # Build Docker image
container clean            # Remove all stopped containers
container init             # Copy/recopy config files
```

## Features

### Unhindered Agents

> Don't want to configure manually? Clone this repo and ask your harness to configure for you.
> ```
> Please configure all my container harnesses to run without permissions.
> ```

Destructive actions are localized inside containers.
- You can let your harness run with full permissions
- To configure your harness to run without permissions, see [`Permissions.md`](Permissions.md).

### Customization

> Don't want to customize manually? Clone this repo and ask your harness to customize for you.
> ```
> Add the following packages to the container environment: ...
> Add a custom mount point to the container environment: ...
> ```

Easily add your own tooling & mount points.

**Adding tools/packages**: Edit `~/.code-container/Dockerfile` and rebuild:

```dockerfile
RUN apt-get update && apt-get install -y postgresql-client redis-tools
```

**Adding mount points**: Edit `~/.code-container/MOUNTS.txt` and reinitialize containers:

```
/absolute/path/on/host:/path/in/container
/absolute/path/on/host:/path/in/container:ro
```

### Security

- Host filesystem protected; destructive operations will only affect the container
- Project isolation prevents cross-contamination across containers
- **Note:** Git config and SSH keys are mounted read-only from host to support Git operations.
- **Caution:** Project files can still be deleted by harness; always use upstream version control
- **Caution:** Network access is still available; information may still be exfiltrated over network

### Simultaneous Work

You and multiple agents can work on the same project simultaneously.

- **Safe**: Reading files, editing files, most development operations
- **Avoid**: Simultaneous Git operations from both sides, installing conflicting `node_modules`
- **Recommended Workflow**: Let your harness run autonomously in the container while you work; review changes and commit.

### Persistence

- Changes within a container persists across sessions.
- Harness configurations and configuration histories are shared across containers.

## Uninstalling

To uninstall `container`, uninstall the NPM package and remove `~/.code-container`:
```bash
# TODO: Add uninstall command
rm -rf ~/.code-container
```
Warning: Consider backing up the harness configurations in `~/.code-container/configs` before removing.
