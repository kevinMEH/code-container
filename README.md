<p align="center">
  <img src=".github/README/banner.png" alt="Banner" />
</p>

#### Code Container: Isolated Docker environment for your autonomous coding harness.

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

On first run, `container` will prompt you to copy your AI harness configs (OpenCode, Codex, Claude Code, Gemini) from `~/` to `~/.code-container/configs` for mounting to the container. You can also run:

```bash
container init
```

This copies configs from:
- `~/.config/opencode` → `~/.code-container/configs/.opencode`
- `~/.codex` → `~/.code-container/configs/.codex`
- `~/.claude` → `~/.code-container/configs/.claude`
- `~/.claude.json` → `~/.code-container/configs/.claude.json`
- `~/.gemini` → `~/.code-container/configs/.gemini`

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

### Container Isolation

Destructive actions are localized inside containers. You can let your harness run with full permissions.

To configure your harness to run without permissions, see [Permissions.md](Permissions.md) for instructions.

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

### Customization

> [!Tip]
> Don't want to customize manually? Ask your harness to customize for you.
> ```
> Add the following packages to the container environment: ...
> Add a custom mount point to the container environment: ...
> ```

**Add tools/packages** — Edit `~/.code-container/Dockerfile` and rebuild:
```dockerfile
RUN apt-get update && apt-get install -y postgresql-client redis-tools
```

**Add mount points** — Edit `~/.code-container/MOUNTS.txt`:
```
/path/on/host:/path/in/container
/path/on/host:/path/in/container:ro
```

Each line is a mount mapping. Lines starting with `#` are ignored. Note that mounts are set at the creation of a container; to update mounts for an existing container, remove and restart.

### Persistence

- **Per-Container**: Packages, file changes, databases, shell history
- **Shared Across Projects**: Harness config, conversation history
- **Read-only from Host**: Git config, SSH keys

### Simultaneous Work

You and your harness can work on the same project simultaneously.

- **Safe**: Reading files, editing files, most development operations

- **Avoid**: Simultaneous Git operations from both sides, installing conflicting `node_modules`

- **Recommended Workflow**: Let your harness run autonomously in the container while you work; review changes and commit.

## Security

- SSH keys and Git config mounted read-only
- Project isolation prevents cross-contamination across containers
- Host filesystem protected (access limited to mounted directories)

**Limitations:**
- Network access still available; information may still be exfiltrated over network
- Project files can still be deleted by harness; always use upstream version control
