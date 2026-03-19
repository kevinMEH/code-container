<p align="center">
  <img src=".github/README/banner.png" alt="Banner" />
</p>

#### Code Container: Isolated container environment for autonomous coding harnesses (Claude Code, OpenCode, Codex, Gemini).

> Inspired by [kevinMEH/code-container](https://github.com/kevinMEH/code-container). Extended significantly for rootless Podman, hardware authentication (YubiKey, 1Password), seamless Claude Code auth, and alternative AI providers.

> [!WARNING]
> **Work in progress** — this project is still evolving rapidly and the field of agentic AI security is very young. Use at your own risk.
>
> **Docker users:** the egress firewall and related network changes have only been tested with Podman. Behaviour on Docker may differ.

## Which Container Solution Is Right For You?

Three projects solve adjacent problems — pick the one that matches your threat model and workflow:

| | This project | [Anthropic devcontainer](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo) | [Trail of Bits](https://github.com/trailofbits/claude-code-devcontainer) |
|---|---|---|---|
| **Primary use case** | Power-user daily driver across multiple AI harnesses | VS Code team dev environments | Security auditing of untrusted code |
| **Auth model** | Seamless — host credentials shared into container | Per-container setup | Fully isolated |
| **Threat model** | Contain the AI, not the repo | Consistent team environments | Malicious repos / adversarial input |
| **Runtime** | Podman (rootless) or Docker | Docker / Dev Containers spec | Docker |
| **AI harnesses** | Claude, OpenCode, Codex, Gemini | Claude | Claude |

**Use this project** if you want YOLO-mode AI assistance on your own trusted code without the friction of re-authentication or tool switching every session.

**Use [Trail of Bits' devcontainer](https://github.com/trailofbits/claude-code-devcontainer)** if you're doing security audits or reviewing untrusted repos — their threat model explicitly accounts for malicious code trying to escape the container.

**Use Anthropic's official devcontainer** if you're on a team that wants a standardised, VS Code-integrated development environment with Claude Code.

## What's Different From Upstream

The original project runs containers as root via Docker and uses NVM for Node.js. This fork needed:

- **Podman (rootless) support** — prefers Podman, falls back to Docker; uses `--userns=keep-id` so file ownership works correctly without running as root
- **Host username in container** — the container user matches your host username (build-time `ARG`), with home at `/container/$USER` to distinguish container sessions from host sessions
- **Seamless Claude Code auth** — mounts `/etc/machine-id`, `~/.claude/`, and `~/.claude.json` so Claude Code sees the same machine identity and credentials as the host; no re-authentication needed
- **Hardware auth passthrough** — 1Password SSH agent socket, GPG agent socket (for YubiKey SSH), GPG config, and YubiKey USB device passthrough
- **mise instead of NVM** — manages Node, Python, pnpm, and all CLI tools from a single config; core tools include opencode, codex, gemini-cli, beads, gastown, fd, ripgrep; additional tools selected via `extra-tools.txt`
- **`--claude` / `--zai` flags** — launch directly into Claude Code (YOLO mode) or Claude with a Z.AI/GLM endpoint
- **Non-blocking exit** — container stop runs in the background so your terminal returns immediately
- **Egress firewall** — iptables whitelist blocks all outbound traffic except approved endpoints (Anthropic, GitHub, npm, pip, mise, Z.AI); applied at every session start via `--cap-add NET_ADMIN`; `--no-firewall` to opt out
- **XDG-aware git config** — checks `~/.config/git` before `~/.gitconfig`

## Quickstart

### Prerequisites

- **Podman** (preferred) or **Docker**
- **Linux** — tested on Manjaro; should work on any systemd distro. macOS/WSL untested.

### Instructions

> [!Tip]
> Don't want to setup manually? Ask your harness to set up for you:
> ```
> Help me setup `container`
> ```

1. **Install as Global Command**: Install the `container` command in a PATH-tracked folder:
  ```bash
  ln -s "$(pwd)/container.sh" /usr/local/bin/container
  ```

2. **Build Image**:
  ```bash
  container --build
  ```
  The image is built with your host username baked in (`--build-arg USERNAME=$USER`). Rebuild if your username changes or you update the Dockerfile.

  **Includes**: Ubuntu 24.04, Node 22, Python 3, pnpm, Claude Code, OpenCode, Codex CLI, Gemini CLI, ripgrep, fd, beads, gastown.

## Usage

Navigate to any project and run `container` to mount project and enter container.
```bash
cd /path/to/project
container                    # Enter container shell
container --claude           # Enter directly into Claude Code (YOLO mode)
container --zai              # Enter Claude with Z.AI/GLM models
```

Inside the container:
```bash
claude                       # Claude Code (already authenticated)
opencode                     # Start OpenCode
codex                        # Start OpenAI Codex
npm install <package>        # Persists per container
pip install <package>        # Persists per container
exit                         # Stops container if last session
```

Session state is saved. Resuming a container picks up exactly where you left off.

### Common Commands

```bash
container                    # Enter container (current directory)
container /path/to/project   # Enter container for a specific project
container --build            # Rebuild image (e.g. after Dockerfile changes)
container --list             # List all containers
container --stop             # Stop current project's container
container --remove           # Remove current project's container
container --clean            # Remove all stopped containers
```

## Z.AI / GLM Models

Create `~/.zai.json` on your host:
```json
{
  "apiUrl": "https://your-endpoint",
  "apiKey": "your-key",
  "haikuModel": "glm-4.5-air",
  "sonnetModel": "glm-5.0",
  "opusModel": "glm-5.0"
}
```

Then: `container --zai`

### Customization

**Add mise-managed tools** — on first build you'll be prompted to copy `extra-tools.default.txt` as your personal `extra-tools.txt`. Edit it to select which tools to install:
```
# Modern CLI replacements
bat           # cat replacement
eza           # ls replacement
sd            # sed replacement

# Git tools
lazygit
delta

# etc — one tool per line, inline comments supported
```
`extra-tools.txt` is gitignored so your selections stay local. `extra-tools.default.txt` is the committed template listing all tools known to work with mise — treat it as a menu. Browse additional options with `mise registry`. Rebuild required after changes.

**Add system packages** — edit `Dockerfile` and rebuild:
```dockerfile
RUN apt-get update && apt-get install -y postgresql-client
```

**Add mount points** — edit `start_new_container()` in `container.sh`:
```bash
-v "$HOME/.config/something:/container/$USER/.config/something:ro"
```

No rebuild needed for mount changes; just remove and relaunch the container.

### Persistence

- **Per-Container**: Packages, file changes, databases, shell history
- **Shared Across Projects**: Claude Code config/credentials/history, npm/pip caches
- **Read-only from Host**: Git config, SSH keys, GPG keys

### Simultaneous Work

You and your harness can work on the same project simultaneously.

- **Safe**: Reading files, editing files, most development operations
- **Avoid**: Simultaneous Git operations from both sides, installing conflicting `node_modules`
- **Recommended Workflow**: Let your harness run autonomously in the container while you work; review changes and commit.

## Security

- Containers run rootless (`--userns=keep-id`) — no host root access
- SSH keys and git config mounted read-only
- Project isolation prevents cross-contamination
- Host filesystem access limited to explicitly mounted directories

### Egress Firewall

Every container session starts with an iptables egress firewall that blocks all outbound traffic except an explicit whitelist. This closes the primary exfiltration vector identified in agentic AI security research.

**Whitelisted by default:**
- `api.anthropic.com`, `statsig.anthropic.com` — Claude API
- `github.com` and related domains — git, gh CLI, releases
- `registry.npmjs.org` — npm
- `pypi.org`, `files.pythonhosted.org` — pip
- `mise.jdx.dev` — mise tool manager
- Host gateway — local services on the host machine
- Z.AI endpoint from `~/.zai.json` — automatically added when present

To add more domains, edit `egress-firewall.sh`. To disable for a session:
```bash
container --no-firewall
```

**Limitations:**
- IP-based rules are resolved at session start; long-running sessions may see CDN IPs rotate
- Project files can still be deleted by the harness; use version control

### Firewall in Action

The following exchange was conducted inside a live container session to verify the firewall behaves as expected:

> **User:** Can you get the reddit.com homepage content?

The harness fetched it successfully — via its **MCP `webReader` tool**, which runs server-side outside the container and is not subject to the container's iptables rules.

> **User:** Can you POST data to Reddit's search form?

```
curl -X POST "https://www.reddit.com/search/" ...
```

Result: **connection timed out on all 4 Reddit IPs**. DNS resolved fine (allowed), but the TCP connection to port 443 was dropped by the firewall.

| Method | Network Access |
|--------|---------------|
| Direct (curl, bash, any shell tool) | ❌ Blocked by iptables |
| MCP server tools (webReader, etc.) | ✅ Runs outside the container |

**Key insight:** The firewall blocks the harness from making direct outbound connections — exfiltrating data, phoning home, or hitting unauthorized APIs. MCP tools that run server-side are outside the container's network namespace and unaffected, which is the expected and correct behaviour.
