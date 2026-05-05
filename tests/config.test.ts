import * as path from "path";
import * as os from "os";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fs, vol } from "memfs";
import {
  APPDATA_DIR,
  CONFIGS_DIR,
  SETTINGS_PATH,
  SHARED_DIRS,
  loadSettings,
  saveSettings,
  ensureConfigDir,
  copyConfigs,
} from "../src/config";

vi.mock("fs");

beforeEach(() => {
  vol.reset();
});

describe("loadSettings", () => {
  it("returns defaults when file does not exist", () => {
    expect(loadSettings()).toEqual({
      completedInit: false,
      acceptedTos: false,
    });
  });

  it("returns parsed settings from valid JSON", () => {
    fs.mkdirSync(APPDATA_DIR, { recursive: true });
    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify({ completedInit: true, acceptedTos: true }),
    );
    expect(loadSettings()).toEqual({ completedInit: true, acceptedTos: true });
  });

  it("throws on invalid JSON", () => {
    fs.mkdirSync(APPDATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, "not json");
    expect(() => loadSettings()).toThrow();
  });

  it("throws when settings fail Zod validation", () => {
    fs.mkdirSync(APPDATA_DIR, { recursive: true });
    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify({ completedInit: "not a boolean" }),
    );
    expect(() => loadSettings()).toThrow();
  });
});

describe("saveSettings", () => {
  it("writes settings as JSON and creates appdata dir", () => {
    saveSettings({ completedInit: true, acceptedTos: false });
    const content = fs.readFileSync(SETTINGS_PATH, "utf-8") as string;
    expect(JSON.parse(content)).toEqual({
      completedInit: true,
      acceptedTos: false,
    });
    expect(fs.existsSync(APPDATA_DIR)).toBe(true);
  });
});

describe("ensureConfigDir", () => {
  it("creates CONFIGS_DIR and all SHARED_DIRS subdirectories", () => {
    ensureConfigDir();
    expect(fs.existsSync(CONFIGS_DIR)).toBe(true);
    for (const dir of SHARED_DIRS) {
      expect(fs.existsSync(path.join(CONFIGS_DIR, dir))).toBe(true);
    }
  });

  it("creates .claude.json with empty object if it does not exist", () => {
    ensureConfigDir();
    const claudeJsonPath = path.join(CONFIGS_DIR, ".claude.json");
    expect(fs.existsSync(claudeJsonPath)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(claudeJsonPath, "utf-8") as string),
    ).toEqual({});
  });

  it("does not overwrite existing .claude.json", () => {
    ensureConfigDir();
    const claudeJsonPath = path.join(CONFIGS_DIR, ".claude.json");
    fs.writeFileSync(claudeJsonPath, '{"existing": true}');
    ensureConfigDir();
    expect(
      JSON.parse(fs.readFileSync(claudeJsonPath, "utf-8") as string),
    ).toEqual({
      existing: true,
    });
  });
});

describe("copyConfigs", () => {
  const home = os.homedir();

  it("copies a directory source to CONFIGS_DIR", () => {
    fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(home, ".claude", "settings.json"), '{"k":"v"}');

    copyConfigs();

    const dest = fs.readFileSync(
      path.join(CONFIGS_DIR, ".claude", "settings.json"),
      "utf-8",
    );
    expect(dest).toBe('{"k":"v"}');
  });

  it("copies a file source to CONFIGS_DIR", () => {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, ".claude.json"), '{"test":true}');

    copyConfigs();

    const dest = fs.readFileSync(
      path.join(CONFIGS_DIR, ".claude.json"),
      "utf-8",
    );
    expect(dest).toBe('{"test":true}');
  });

  it("copies nested directory structure recursively", () => {
    fs.mkdirSync(path.join(home, ".codex", "subdir", "nested"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(home, ".codex", "root.txt"), "root");
    fs.writeFileSync(path.join(home, ".codex", "subdir", "mid.txt"), "mid");
    fs.writeFileSync(
      path.join(home, ".codex", "subdir", "nested", "deep.txt"),
      "deep",
    );

    copyConfigs();

    expect(
      fs.readFileSync(path.join(CONFIGS_DIR, ".codex", "root.txt"), "utf-8"),
    ).toBe("root");
    expect(
      fs.readFileSync(
        path.join(CONFIGS_DIR, ".codex", "subdir", "mid.txt"),
        "utf-8",
      ),
    ).toBe("mid");
    expect(
      fs.readFileSync(
        path.join(CONFIGS_DIR, ".codex", "subdir", "nested", "deep.txt"),
        "utf-8",
      ),
    ).toBe("deep");
  });

  it("skips non-existent sources without error", () => {
    copyConfigs();
  });
});
