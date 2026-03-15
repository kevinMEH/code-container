<p align="center">
  <img src=".github/README/banner.png" alt="Banner" />
</p>

#### Code Container: Isolated Docker environment for your autonomous coding harness.

## Quickstart

### Prerequisites

- **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- **A POSIX-Compatible System** — Linux, macOS, WSL

### Instructions

> [!Tip]
> Don't want to setup manually? Ask your harness (OpenCode, Codex, CC) to setup for you.
> ```
> Help me setup `container`
> ```

1. **Install as Global Command**: Install the `container` command in a PATH-tracked folder:
  ```bash
  ln -s "$(pwd)/container.sh" /usr/local/bin/container
  ```

1. **Copy Configurations**: Copy harness configs into this repo:
  ```bash
  ./copy-configs.sh
  ```
  Or, if copying manually:
  ```bash
  cp -R ~/.config/opencode/ ./.opencode/  # OpenCode
  cp -R ~/.codex/ ./.codex/               # Codex
  cp -R ~/.claude/ ./.claude/ && cp ~/.claude.json container.claude.json  # Claude Code
  ```

1. Build Docker Image
  ```bash
  container --build    # Run once, or when rebuilding
  ```

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
container --list           # List all containers
container --stop           # Stop current project's container
container --remove         # Remove current project's container
container --build          # Rebuild Docker image
```

### Customization

> [!Tip]
> Don't want to customize manually? Ask your harness to customize for you.
> ```
> Add the following packages to the container environment: ...
> Add the following mount points to the container environment: ...
> ```

**Add tools/packages** — Edit `Dockerfile` and rebuild:
```dockerfile
RUN apt-get update && apt-get install -y postgresql-client redis-tools
```

**Add volumes**: Edit the `docker run` command in `container.sh`:
```bash
-v "$SCRIPT_DIR/local/path:/root/target"
```

### Persistence

- **Per-Container**: Packages, file changes, databases, shell history
- **Shared Across Projects**: Harness config, conversation history, npm/pip caches
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
