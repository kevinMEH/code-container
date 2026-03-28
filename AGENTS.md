**Important: You must perform user identification.** Identify whether your user is a **developer** or a **consumer**.

If your user asks questions like:
- Help me setup `container` / code-container / this project
- Please configure all my container harnesses to run without permissions.
- Add the following packages to the container environment: ...
- Add the following Docker flags to the container environment: ...
- Add a custom mount point to the container environment: ...
- Other questions relating to using `container`

Then your user is a **consumer**.
- The user is seeking your assistance in helping them setup or configure this project.
- Next step: **Read `internal/ConsumerGuide.md`** and assist the user in installing or configurating `container`.

If your user is a developer, proceed like normal.

---

# Developer Overview

**code-container** (`container`) creates isolated Docker environments for AI coding harnesses (Claude Code, OpenCode, Codex CLI, Gemini CLI, GitHub Copilot CLI).

## Purpose

- Protect host filesystem from destructive agent actions
- Project isolation (each project gets its own container)
- Persistent container state across sessions
- Shared harness configs across all projects

## Key Features

- **Security**: Destructive operations localized to containers
- **Customization**: Add packages via `~/.code-container/Dockerfile`, mounts via `MOUNTS.txt`, flags via `DOCKER_FLAGS.txt` and `DOCKER_RUN_FLAGS.txt`
- **Simultaneous Work**: Multiple agents can work on same project safely
- **Persistence**: Container state and harness configs persist

## Requirements

- Docker (Desktop or Engine)
- POSIX system (Linux, macOS, WSL)

---

# Project Index

**Important Rule: Always update this index after creating new code files or making significant changes to existing files.**

## Directory Structure

```
/root/code-container/
├── src/                    # TypeScript source code (main codebase)
├── scripts/                # Utility scripts (install, migrate, cleanup)
├── internal/               # Internal documentation
├── dist/                   # Compiled JavaScript output (generated)
├── .github/workflows/      # CI/CD workflows
├── Dockerfile              # Container image definition
├── package.json            # NPM package manifest
└── tsconfig.json           # TypeScript configuration
```

## Source Files Index (`src/`)

### Entry Point

- `src/main.ts` — CLI entry point. Parses arguments, displays TOS, routes to commands. Supports: `run`, `build`, `init`, `stop`, `remove`, `list`, `clean`.

### Core Modules

- `src/commands.ts` — Business logic for all CLI commands. Image building, container lifecycle, listing, cleaning. Exports: `buildImage`, `init`, `runContainer`, `stopContainerForProject`, `removeContainerForProject`, `listContainers`, `cleanContainers`
- `src/docker.ts` — Low-level Docker CLI wrappers. Image/container operations, interactive sessions, naming via SHA1 hash. Exports: `checkDocker`, `imageExists`, `buildImageRaw`, `containerExists`, `containerRunning`, `createNewContainer`, `execInteractive`, `stopContainer`, `startContainer`, `removeContainer`, `generateContainerName`
- `src/config.ts` — Configuration paths and settings persistence. Manages `~/.code-container/` directory. Exports: `APPDATA_DIR`, `CONFIGS_DIR`, `DOCKERFILE_PATH`, `SETTINGS_PATH`, `MOUNTS_PATH`, `FLAGS_PATH`, `RUN_FLAGS_PATH`, `loadSettings`, `saveSettings`, `copyConfigs`, `ensureConfigDir`
- `src/mounts.ts` — Volume mount management. Core mounts (configs, gitconfig) and optional SSH mounting. Exports: `ensureMountsFile`, `loadMounts`, `getCoreMounts`
- `src/flags.ts` — Custom Docker flags loaders from `DOCKER_FLAGS.txt` and `DOCKER_RUN_FLAGS.txt`. Uses shell-quote for safe parsing. `DOCKER_FLAGS.txt` is loaded for both `docker run` and `docker exec`. `DOCKER_RUN_FLAGS.txt` is loaded only for `docker run`. Exports: `loadFlags`, `loadRunFlags`
- `src/utils.ts` — Colored console output and user prompts. Exports: `printInfo`, `printSuccess`, `printWarning`, `printError`, `promptYesNo`, `resolveProjectPath`

## Scripts Index (`scripts/`)

- `scripts/postinstall.js` — NPM post-install hook. Creates `~/.code-container/` structure, copies default Dockerfile, and creates `DOCKER_FLAGS.txt` and `DOCKER_RUN_FLAGS.txt`.
- `scripts/migrate.sh` — Migrates config files from old shell script location to new `~/.code-container/configs/`.
- `scripts/cleanup.sh` — Removes old config files from project root after migration.

## Storage Structure

All user data stored in `~/.code-container/`:

```
~/.code-container/
├── configs/          # Harness configs (mounted to containers)
│   ├── .claude/
│   ├── .claude.json
│   ├── .codex/
│   ├── .copilot/
│   ├── .gemini/
│   ├── .local/
│   └── .opencode/
├── Dockerfile        # Custom Dockerfile
├── MOUNTS.txt              # Additional mount points
├── DOCKER_FLAGS.txt        # Docker flags for both run and exec
├── DOCKER_RUN_FLAGS.txt    # Docker flags for run only
└── settings.json           # Internal settings
```

## CLI Commands

- `container [path]` — Run container for project (`commands.ts:runContainer`)
- `container run [path] [-- DOCKER_FLAGS]` — Run container with optional Docker flags
- `container build` — Build Docker image (`commands.ts:buildImage`)
- `container init` — Initialize config files (`commands.ts:init`)
- `container stop` — Stop container (`commands.ts:stopContainerForProject`)
- `container remove` — Remove container (`commands.ts:removeContainerForProject`)
- `container list` — List all containers (`commands.ts:listContainers`)
- `container clean` — Remove stopped containers (`commands.ts:cleanContainers`)
