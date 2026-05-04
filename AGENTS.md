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
- Next step: **Read `docs/ConsumerGuide.md`** and assist the user in installing or configurating `container`.

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
- **Customization**: Add packages via `~/.code-container/Dockerfile.User`, mounts via `MOUNTS.txt`, flags via `DOCKER_FLAGS.txt` and `DOCKER_RUN_FLAGS.txt`
- **Simultaneous Work**: Multiple agents can work on same project safely
- **Persistence**: Container state and harness configs persist

## Requirements

- Docker (Desktop or Engine)
- POSIX system (Linux, macOS, WSL)
