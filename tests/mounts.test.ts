import * as path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fs, vol } from "memfs";
import { loadMounts } from "../src/mounts";
import { CONFIGS_DIR, MOUNTS_PATH } from "../src/config";
import * as os from "os";

vi.mock("fs");

const home = os.homedir();

beforeEach(() => {
  vol.reset();
});

describe("loadMounts", () => {
  it("returns core mounts when MOUNTS.txt does not exist", () => {
    const mounts = loadMounts();
    expect(mounts).toContain(`${CONFIGS_DIR}/.claude:/home/developer/.claude`);
    expect(mounts).toContain(
      `${home}/.gitconfig:/home/developer/.gitconfig:ro`,
    );
  });

  it("merges extra mounts from MOUNTS.txt", () => {
    fs.mkdirSync(path.dirname(MOUNTS_PATH), { recursive: true });
    fs.writeFileSync(MOUNTS_PATH, "/host/path:/container/path\n");

    const mounts = loadMounts();
    expect(mounts).toContain("/host/path:/container/path");
    expect(mounts).toContain(`${CONFIGS_DIR}/.claude:/home/developer/.claude`);
  });

  it("deduplicates mounts", () => {
    fs.mkdirSync(path.dirname(MOUNTS_PATH), { recursive: true });
    const coreMount = `${CONFIGS_DIR}/.claude:/home/developer/.claude`;
    fs.writeFileSync(MOUNTS_PATH, `${coreMount}\n`);

    const mounts = loadMounts();
    const occurrences = mounts.filter((m) => m === coreMount).length;
    expect(occurrences).toBe(1);
  });

  it("strips blank lines and comments from MOUNTS.txt", () => {
    fs.mkdirSync(path.dirname(MOUNTS_PATH), { recursive: true });
    fs.writeFileSync(MOUNTS_PATH, "\n# a comment\n  \n/valid:/mount\n");

    const mounts = loadMounts();
    expect(mounts).toContain("/valid:/mount");
    expect(mounts.find((m) => m.includes("comment"))).toBeUndefined();
  });

  it("trims whitespace from mount lines", () => {
    fs.mkdirSync(path.dirname(MOUNTS_PATH), { recursive: true });
    fs.writeFileSync(MOUNTS_PATH, "  /spaces:/here  \n");

    const mounts = loadMounts();
    expect(mounts).toContain("/spaces:/here");
  });
});
