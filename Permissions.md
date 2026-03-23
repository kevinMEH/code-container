# Harness Permissions

This document contains instructions for configuring each coding harness to run with full permissions inside Docker containers.

Configuration storage location: `~/.code-container/configs`

## OpenCode

Settings file location: `.opencode/opencode.json`

Add the following properties:
```json
{
  "permission": "allow"
}
```

## OpenAI Codex

Config file location: `.codex/config.toml`

Add the following lines:
```toml
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

## Claude Code

Settings file location: `.claude/settings.json`

Add the following properties:
```json
{
  "permissions": {
    "allow": [
      "*",
      "Bash"
    ]
  }
}
```

## Gemini CLI

Gemini uses a "policy engine" to determine tool usage approvals. To bypass permissions, perform the following:

1. Navigte to the configuration storage location if not already:
    ```bash
    cd ~/.code-container/configs
    ```

2. Create the policies directory if it doesn't already exist:
    ```bash
    mkdir -p .gemini/policies
    ```

3. Create a rule file at `.gemini/policies/rules.toml` with the following contents:
    ```toml
    [[rule]]
    toolName = ["run_shell_command", "write_file", "replace"]
    decision = "allow"
    priority = 777
    ```

## GitHub Copilot CLI

GitHub Copilot CLI authenticates via the `gh` CLI using an OAuth token stored in `~/.config/gh/hosts.yml`. Running `container init` will copy your existing `gh` authentication into the container automatically.

To authenticate inside the container (if not already authenticated on the host):

```bash
gh auth login
```

To verify authentication inside the container:

```bash
gh auth status
gh copilot --version
```

No additional permission bypass configuration is required — `gh copilot` does not have a separate approval/permissions system.
