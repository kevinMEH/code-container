import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkDocker,
  imageExists,
  containerExists,
  containerRunning,
  getOtherSessionCount,
  stopContainerIfLastSession,
  createNewContainer,
  generateContainerName,
  getStoppedContainerIds,
} from "../src/docker";

vi.mock("child_process");
vi.mock("fs");
vi.mock("../src/utils", () => ({
  printInfo: vi.fn(),
  printError: vi.fn(),
  promptYesNo: vi.fn(),
}));

import {
  enqueue,
  getCalls,
  reset,
  getQueueLength,
} from "../__mocks__/child_process";

beforeEach(() => {
  reset();
});

afterEach(() => {
  const remainingQueue = getQueueLength();
  if (remainingQueue > 0) {
    throw new Error(
      `Test did not consume all mocked spawnSync responses. ${remainingQueue} remaining in queue.`,
    );
  }
});

describe("checkDocker", () => {
  it("does nothing when docker is available", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as () => never);
    checkDocker();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("calls process.exit when docker is not available", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    expect(() => checkDocker()).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});

describe("imageExists", () => {
  it("returns true when status is 0", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    expect(imageExists()).toBe(true);
  });

  it("returns false when status is non-zero", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    expect(imageExists()).toBe(false);
  });
});

describe("containerExists", () => {
  it("returns true when status is 0", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    expect(containerExists("container-foo-abc12345")).toBe(true);
  });

  it("returns false when status is non-zero", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    expect(containerExists("container-foo-abc12345")).toBe(false);
  });
});

describe("containerRunning", () => {
  it("returns true when status is 0 and stdout is 'true'", () => {
    enqueue({ status: 0, stdout: "true\n", stderr: "" });
    expect(containerRunning("container-foo-abc12345")).toBe(true);
  });

  it("returns false when status is 0 but stdout is 'false'", () => {
    enqueue({ status: 0, stdout: "false\n", stderr: "" });
    expect(containerRunning("container-foo-abc12345")).toBe(false);
  });

  it("returns false when status is non-zero", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    expect(containerRunning("container-foo-abc12345")).toBe(false);
  });
});

describe("getOtherSessionCount", () => {
  it("returns 0 when ps fails", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    expect(getOtherSessionCount("container-foo-abc12345", "foo")).toBe(0);
  });

  it("counts matching docker exec sessions", () => {
    enqueue({
      status: 0,
      stdout:
        "docker exec -it -w /root/foo container-foo-abc12345 /bin/bash\n" +
        "docker exec -it -w /root/foo container-foo-abc12345 /bin/bash\n" +
        "some other process\n",
      stderr: "",
    });
    expect(getOtherSessionCount("container-foo-abc12345", "foo")).toBe(2);
  });

  it("does not count non-matching sessions", () => {
    enqueue({
      status: 0,
      stdout:
        "docker exec -it -w /root/bar container-bar-xyz /bin/bash\n" +
        "ps ax -o command=\n",
      stderr: "",
    });
    expect(getOtherSessionCount("container-foo-abc12345", "foo")).toBe(0);
  });
});

describe("stopContainerIfLastSession", () => {
  it("calls stopContainer when no other sessions", () => {
    enqueue({ status: 0, stdout: "unrelated\n", stderr: "" });
    enqueue({ status: 0, stdout: "", stderr: "" });
    stopContainerIfLastSession("container-foo-abc12345", "foo");
    const calls = getCalls();
    const stopCall = calls.find((c) => c.args && c.args[0] === "stop");
    expect(stopCall).toBeDefined();
  });

  it("skips stop when other sessions exist", () => {
    enqueue({
      status: 0,
      stdout: "docker exec -it -w /root/foo container-foo-abc12345 /bin/bash\n",
      stderr: "",
    });
    stopContainerIfLastSession("container-foo-abc12345", "foo");
    const calls = getCalls();
    const stopCall = calls.find((c) => c.args && c.args[0] === "stop");
    expect(stopCall).toBeUndefined();
  });
});

describe("createNewContainer", () => {
  it("constructs correct docker run arguments", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    createNewContainer("container-foo-abc12345", "foo", "/home/user/foo");

    const calls = getCalls();
    const runCall = calls[calls.length - 1];
    expect(runCall.command).toBe("docker");
    expect(runCall.args![0]).toBe("run");
    expect(runCall.args).toContain("-d");
    expect(runCall.args).toContain("--name");
    expect(runCall.args).toContain("container-foo-abc12345");
    expect(runCall.args).toContain("-e");
    expect(runCall.args).toContain("TERM=xterm-256color");
    expect(runCall.args).toContain("-w");
    expect(runCall.args).toContain("/root/foo");
    expect(runCall.args).toContain("-v");
    expect(runCall.args).toContain("/home/user/foo:/root/foo");
    expect(runCall.args![runCall.args!.length - 3]).toBe(
      "code-container:latest",
    );
    expect(runCall.args![runCall.args!.length - 2]).toBe("sleep");
    expect(runCall.args![runCall.args!.length - 1]).toBe("infinity");
  });

  it("includes cliFlags in the argument list", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    createNewContainer("container-foo-abc12345", "foo", "/home/user/foo", [
      "-p",
      "8080:80",
    ]);

    const calls = getCalls();
    const runCall = calls[calls.length - 1];
    expect(runCall.args).toContain("-p");
    expect(runCall.args).toContain("8080:80");
  });

  it("returns true on success", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    expect(createNewContainer("c", "p", "/path")).toBe(true);
  });

  it("includes COLORTERM environment variable", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    createNewContainer("container-foo-abc12345", "foo", "/home/user/foo");

    const calls = getCalls();
    const runCall = calls[calls.length - 1];
    expect(runCall.args).toContain("-e");
    expect(runCall.args).toContain("COLORTERM=truecolor");
  });

  it("returns false on failure", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    expect(createNewContainer("c", "p", "/path")).toBe(false);
  });
});

describe("generateContainerName", () => {
  it("strips trailing slash from path", () => {
    const resultWithSlash = generateContainerName("/home/user/project/");
    const resultWithoutSlash = generateContainerName("/home/user/project");
    expect(resultWithSlash).toBe(resultWithoutSlash);
    expect(resultWithSlash).toMatch(/^container-project-[a-f0-9]{8}$/);
  });

  it("generates consistent hash for same path", () => {
    const result1 = generateContainerName("/home/user/myproject");
    const result2 = generateContainerName("/home/user/myproject");
    expect(result1).toBe(result2);
  });

  it("generates different hashes for different paths", () => {
    const result1 = generateContainerName("/home/user/project1");
    const result2 = generateContainerName("/home/user/project2");
    expect(result1).not.toBe(result2);
  });
});

describe("getStoppedContainerIds", () => {
  it("returns empty array when no stopped containers", () => {
    enqueue({ status: 0, stdout: "", stderr: "" });
    expect(getStoppedContainerIds()).toEqual([]);
  });

  it("returns empty array for whitespace-only output", () => {
    enqueue({ status: 0, stdout: "   \n\t  ", stderr: "" });
    expect(getStoppedContainerIds()).toEqual([]);
  });

  it("parses single container ID", () => {
    enqueue({ status: 0, stdout: "abc123\n", stderr: "" });
    expect(getStoppedContainerIds()).toEqual(["abc123"]);
  });

  it("parses multiple container IDs", () => {
    enqueue({
      status: 0,
      stdout: "abc123\ndef456\nghi789\n",
      stderr: "",
    });
    expect(getStoppedContainerIds()).toEqual(["abc123", "def456", "ghi789"]);
  });
});
