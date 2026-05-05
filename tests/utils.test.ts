import { describe, it, expect } from "vitest";
import { resolveProjectPath } from "../src/utils";

describe("resolveProjectPath", () => {
  it("returns cwd when input is undefined", () => {
    const result = resolveProjectPath(undefined);
    expect(result).toBe(process.cwd());
  });

  it("resolves a relative path to absolute", () => {
    const result = resolveProjectPath("some/dir");
    expect(result.startsWith("/")).toBe(true);
    expect(result.endsWith("some/dir")).toBe(true);
  });

  it("returns an absolute path unchanged", () => {
    const result = resolveProjectPath("/absolute/path");
    expect(result).toBe("/absolute/path");
  });
});
