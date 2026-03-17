import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { z } from "zod";

export const APPDATA_DIR = path.join(os.homedir(), ".code-container");
export const CONFIGS_DIR = path.join(APPDATA_DIR, "configs");
export const DOCKERFILE_PATH = path.join(APPDATA_DIR, "Dockerfile");
export const SETTINGS_PATH = path.join(APPDATA_DIR, "settings.json");

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

const SettingsSchema = z.object({
  completedInit: z.boolean().default(false),
});

export type Settings = z.infer<typeof SettingsSchema>;

export function loadSettings(): Settings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { completedInit: false };
  }
  const content = fs.readFileSync(SETTINGS_PATH, "utf-8");
  return SettingsSchema.parse(JSON.parse(content));
}

export function saveSettings(settings: Settings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
}

const CONFIG_SOURCES: Array<{ src: string; dest: string; isDir: boolean }> = [
  { src: path.join(os.homedir(), ".config", "opencode"), dest: ".opencode", isDir: true },
  { src: path.join(os.homedir(), ".codex"), dest: ".codex", isDir: true },
  { src: path.join(os.homedir(), ".gemini"), dest: ".gemini", isDir: true },
  { src: path.join(os.homedir(), ".claude"), dest: ".claude", isDir: true },
  { src: path.join(os.homedir(), ".claude.json"), dest: ".claude.json", isDir: false },
];

export function copyConfigs(): void {
  ensureConfigDir();

  for (const { src, dest, isDir } of CONFIG_SOURCES) {
    const destPath = path.join(CONFIGS_DIR, dest);
    if (fs.existsSync(src)) {
      if (isDir) {
        fs.cpSync(src, destPath, { recursive: true });
      } else {
        fs.copyFileSync(src, destPath);
      }
    }
  }
}

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
