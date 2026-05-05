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

2. Run the following to copy all your AI harness configs from `~/` to `~/.code-container/configs` for mounting onto the container.

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

### Shameless Self-Promotion

Psst: Try my newest project: [Nitro, a simple and efficient Bash harness.](https://github.com/aerovato/nitro) 11x cheaper; 75x more efficient vs Claude Code for simple Bash tasks.

```bash
npm install -g @aerovato/nitro
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

### Common Commands

```bash
container                  # Enter the container
container run /path/to     # Enter container for specific project
container build            # Build full Docker image (all stages)
container build packages   # Rebuild from Packages stage
container build harness    # Rebuild from Harness stage (update harnesses)
container build user       # Rebuild User stage only (update your tooling)
container list             # List all containers
container stop             # Stop current project's container
container remove           # Remove current project's container
container clean            # Remove all stopped containers
container init             # Copy/recopy config files
```

## Features

> **Tip:** Don't want to configure manually? Clone this repo and ask your harness to configure for you.
>
> ```
> Please configure all my container harnesses to run without permissions.
> Add the following packages to the container environment: ...
> Add a custom mount point to the container environment: ...
> ```

### Unhindered Agents

Destructive actions are localized inside containers.

- You can let your harness run with full permissions
- To configure your harness to run without permissions, see [`Permissions.md`](docs/Permissions.md).

### Docker Image Customization

The image is built in 4 cascading stages:

1. **Core** (packaged): Ubuntu 24.04, system dependencies, Node + NVM, Python
2. **Packages** (customizable): Large user-specified packages & tooling
3. **Harness** (packaged): OpenCode, Codex, Claude Code, etc.
4. **User** (customizable): Small user-specified packages & setup scripts

##### `~/.code-container/Dockerfile.Packages`: Add large packages and build tools

```dockerfile
FROM code-container-core:latest

RUN apt-get update && apt-get install -y postgresql-client redis-tools
```

##### `~/.code-container/Dockerfile.User`: Add user-level tools or setup scripts

```dockerfile
FROM code-container-base:latest

RUN npm install -g bun typescript
RUN pip install requests

RUN npx opencode plugin opencode-quotes-plugin -g
```

**After modifying:** Quickly rebuild use the appropriate build target:

```bash
container build packages   # Rebuild from Packages stage
container build user       # Rebuild from User stage only (very fast)
```

### Customize Docker Entry Commands

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

### Simultaneous Work

You and multiple agents can work on the same project simultaneously.

- **Safe**: Reading files, editing files, most development operations
- **Avoid**: Simultaneous Git operations from both sides, installing conflicting `node_modules`
- **Recommended Workflow**: Let your harness run autonomously in the container while you work; review changes and commit.

### Persistence

- Changes within a container persists across sessions.
- Harness configurations and configuration histories are shared across containers.

## Security

- `container` protects your host filesystem
- Destructive operations will only affect the container
- Isolation prevents cross-contamination across containers
- **Note:** Git config and SSH keys are mounted read-only from host to support Git operations.
- **Caution:** Project files can still be deleted by harness; always use upstream version control
- **Caution:** Network access is still available; information may still be exfiltrated over network

#### Security Advisory ⚠️

- The main purpose of `container` is to protect commands like `rm` or `apt` from unintentionally affecting your system.
- `container` does not protect from prompt injections or network exfiltration in the event that your agent becomes malaligned.
- Users are advised to not download or work with unverified software even within the container.
- Sensitive information inside the container may still be exfiltrated by an attacker just as with your regular system.

## Uninstalling

To uninstall `container`, uninstall the NPM package and remove `~/.code-container`:

```bash
npm uninstall -g code-container
rm -rf ~/.code-container
```

Consider backing up the harness configurations in `~/.code-container/configs` before removing.
