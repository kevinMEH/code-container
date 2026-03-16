import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export const APPDATA_DIR = path.join(os.homedir(), ".code-container");
export const CONFIGS_DIR = path.join(APPDATA_DIR, "configs");
export const DOCKERFILE_PATH = path.join(APPDATA_DIR, "Dockerfile");

export const SHARED_DIRS = [
  ".claude",
  ".codex",
  ".local",
  ".opencode",
  ".gemini",
];

export const MOUNT_TARGETS: Record<string, string> = {
  ".claude": "/root/.claude",
  ".claude.json": "/root/.claude.json",
  ".codex": "/root/.codex",
  ".opencode": "/root/.config/opencode",
  ".gemini": "/root/.gemini",
  ".local": "/root/.local",
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(APPDATA_DIR)) {
    fs.mkdirSync(APPDATA_DIR, { recursive: true, mode: 0o700 });
  } else {
    fs.chmodSync(APPDATA_DIR, 0o700);
  }

  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true, mode: 0o700 });
  } else {
    fs.chmodSync(CONFIGS_DIR, 0o700);
  }

  for (const dir of SHARED_DIRS) {
    const fullPath = path.join(CONFIGS_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true, mode: 0o700 });
    }
  }

  const claudeJsonPath = path.join(CONFIGS_DIR, ".claude.json");
  if (!fs.existsSync(claudeJsonPath)) {
    fs.writeFileSync(claudeJsonPath, "{}", { mode: 0o600 });
  }
}
