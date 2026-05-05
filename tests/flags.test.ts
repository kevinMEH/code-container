import * as path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fs, vol } from "memfs";
import { loadFlags, FlagSource } from "../src/flags";
import { FLAGS_PATH, RUN_FLAGS_PATH } from "../src/config";

vi.mock("fs");

beforeEach(() => {
  vol.reset();
});

function writeFlagsFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("loadFlags", () => {
  it("returns empty array when file does not exist", () => {
    expect(loadFlags(FlagSource.Common)).toEqual([]);
  });

  it("returns empty array for empty file", () => {
    writeFlagsFile(FLAGS_PATH, "");
    expect(loadFlags(FlagSource.Common)).toEqual([]);
  });

  it("skips blank lines and comments", () => {
    writeFlagsFile(FLAGS_PATH, "\n# comment\n  \n# another\n");
    expect(loadFlags(FlagSource.Common)).toEqual([]);
  });

  it("parses a simple flag", () => {
    writeFlagsFile(FLAGS_PATH, "--rm");
    expect(loadFlags(FlagSource.Common)).toEqual(["--rm"]);
  });

  it("parses a flag with a value", () => {
    writeFlagsFile(FLAGS_PATH, "--network host");
    expect(loadFlags(FlagSource.Common)).toEqual(["--network", "host"]);
  });

  it("parses multiple lines into a flat array", () => {
    writeFlagsFile(FLAGS_PATH, "--network host\n--rm");
    expect(loadFlags(FlagSource.Common)).toEqual(["--network", "host", "--rm"]);
  });

  it("handles quoted values", () => {
    writeFlagsFile(FLAGS_PATH, '--env FOO="bar baz"');
    expect(loadFlags(FlagSource.Common)).toEqual(["--env", "FOO=bar baz"]);
  });

  it("rejects lines with shell operators and calls printError", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    writeFlagsFile(FLAGS_PATH, "--rm; rm -rf /");
    expect(loadFlags(FlagSource.Common)).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("collects valid lines and skips invalid ones", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    writeFlagsFile(FLAGS_PATH, "--rm\n--network host && echo pwned\n--detach");
    expect(loadFlags(FlagSource.Common)).toEqual(["--rm", "--detach"]);
    errorSpy.mockRestore();
  });

  it("handles trailing newline", () => {
    writeFlagsFile(FLAGS_PATH, "--rm\n");
    expect(loadFlags(FlagSource.Common)).toEqual(["--rm"]);
  });
});

describe("loadFlags with FlagSource.Run", () => {
  it("returns empty array when file does not exist", () => {
    expect(loadFlags(FlagSource.Run)).toEqual([]);
  });

  it("parses flags from RUN_FLAGS_PATH", () => {
    writeFlagsFile(RUN_FLAGS_PATH, "-p 8080:80\n--rm");
    expect(loadFlags(FlagSource.Run)).toEqual(["-p", "8080:80", "--rm"]);
  });
});
