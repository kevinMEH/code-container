<p align="center">
  <img src="https://raw.githubusercontent.com/kevinMEH/code-container/main/.github/README/banner.png" alt="Banner" />
</p>

#### Code Container: Isolated Docker environment for your autonomous coding harness.

#### Simple. Lightweight. Secure.

## Quickstart

### Prerequisites

- **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- **A POSIX-Compatible System** — Linux, macOS, WSL

### Installation

1. `container` is available as a NPM package. To install, simply run:
    ```bash
    npm install -g code-container
    ```

2. Then run the following to copy all your AI harness configs from `~/` to `~/.code-container/configs` for mounting onto the container.
    ```bash
    container init
    ```
    Alternatively, you can copy configs manually:
    - `~/.config/opencode` → `~/.code-container/configs/.opencode`
    - `~/.codex` → `~/.code-container/configs/.codex`
    - `~/.copilot` → `~/.code-container/configs/.copilot`
    - `~/.claude` → `~/.code-container/configs/.claude`
    - `~/.claude.json` → `~/.code-container/configs/.claude.json`
    - `~/.gemini` → `~/.code-container/configs/.gemini`

3. Finally, build the Docker image. This may take up to 5 minutes.
    ```bash
    container build
    ```

You're done 🎉; `container` is now ready to use.

### Migration from `container.sh`

> [!Note]
> Are you still on the shell script version of `container`? Migrate to the NPM package by running the following:
> ```bash
> # Exit all containers & save important work...
> npm install -g code-container
> bash scripts/migrate.sh     # Migrate configs over to ~/.code-container/configs
> bash scripts/cleanup.sh     # Optional: Cleanup config files
> container build
> ```
> Note: Ensure that all work is saved and the container is ready for deletion. Containers from the previous version are not compatible with containers from the current version.

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
- To configure your harness to run without permissions, see [`Permissions.md`](docs/Permissions.md).

### Customization

> Don't want to customize manually? Clone this repo and ask your harness to customize for you.
> ```
> Add the following packages to the container environment: ...
> Add the following Docker flags to the container environment: ...
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

**Adding Docker flags**:

Edit `~/.code-container/DOCKER_FLAGS.txt` to pass additional flags to both `docker run` and `docker exec`:

```
# Environment variables
-e MY_VAR=value
```

For flags that only apply to `docker run` (e.g. port forwarding, network, GPU), use `~/.code-container/DOCKER_RUN_FLAGS.txt`:

```
# Port forwarding
-p 4040:4040
-p 3000:3000

# GPU support
--gpus all
```

Each line is parsed like a shell command. Empty lines and lines starting with `#` are ignored.

### Security

- Host filesystem protected; destructive operations will only affect the container
- Project isolation prevents cross-contamination across containers
- **Note:** Git config and SSH keys are mounted read-only from host to support Git operations.
- **Caution:** Project files can still be deleted by harness; always use upstream version control
- **Caution:** Network access is still available; information may still be exfiltrated over network

#### ⚠️ Security Advisory:
- The main purpose of `container` is to protect commands like `rm` or `apt` from unintentionally affecting your system.
  - `container` assumes that your agent is acting in good faith.
- `container` does not protect from prompt injections or network exfiltration in the event that an agent becomes malaligned.
  - Users are advised to not download or work with unverified software even within the container.
  - Sensitive information inside the container may still be exfiltrated by an attacker just as with your regular system. This includes:
    - OAuth credentials inside harness configs
    - API keys inside harness configs
    - SSH keys for git functionality

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
npm uninstall -g code-container
rm -rf ~/.code-container
```
Warning: Consider backing up the harness configurations in `~/.code-container/configs` before removing.
