import * as path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { spawnSync } from "child_process";
import {
  checkDocker,
  imageExists,
  containerExists,
  containerRunning,
  getOtherSessionCount,
  stopContainerIfLastSession,
  createNewContainer,
} from "../src/docker";

vi.mock("child_process");
vi.mock("fs");

beforeEach(() => {
  spawnSync.__reset();
});

describe("checkDocker", () => {
  it("does nothing when docker is available", () => {
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    checkDocker();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("calls process.exit when docker is not available", () => {
    spawnSync.__enqueue({ status: 1, stdout: "", stderr: "" });
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
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    expect(imageExists()).toBe(true);
  });

  it("returns false when status is non-zero", () => {
    spawnSync.__enqueue({ status: 1, stdout: "", stderr: "" });
    expect(imageExists()).toBe(false);
  });
});

describe("containerExists", () => {
  it("returns true when status is 0", () => {
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    expect(containerExists("container-foo-abc12345")).toBe(true);
  });

  it("returns false when status is non-zero", () => {
    spawnSync.__enqueue({ status: 1, stdout: "", stderr: "" });
    expect(containerExists("container-foo-abc12345")).toBe(false);
  });
});

describe("containerRunning", () => {
  it("returns true when status is 0 and stdout is 'true'", () => {
    spawnSync.__enqueue({ status: 0, stdout: "true\n", stderr: "" });
    expect(containerRunning("container-foo-abc12345")).toBe(true);
  });

  it("returns false when status is 0 but stdout is 'false'", () => {
    spawnSync.__enqueue({ status: 0, stdout: "false\n", stderr: "" });
    expect(containerRunning("container-foo-abc12345")).toBe(false);
  });

  it("returns false when status is non-zero", () => {
    spawnSync.__enqueue({ status: 1, stdout: "", stderr: "" });
    expect(containerRunning("container-foo-abc12345")).toBe(false);
  });
});

describe("getOtherSessionCount", () => {
  it("returns 0 when ps fails", () => {
    spawnSync.__enqueue({ status: 1, stdout: "", stderr: "" });
    expect(getOtherSessionCount("container-foo-abc12345", "foo")).toBe(0);
  });

  it("counts matching docker exec sessions", () => {
    spawnSync.__enqueue({
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
    spawnSync.__enqueue({
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
    spawnSync.__enqueue({ status: 0, stdout: "unrelated\n", stderr: "" });
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    stopContainerIfLastSession("container-foo-abc12345", "foo");
    const calls = spawnSync.__getCalls();
    const stopCall = calls.find(c => c.args && c.args[0] === "stop");
    expect(stopCall).toBeDefined();
  });

  it("skips stop when other sessions exist", () => {
    spawnSync.__enqueue({
      status: 0,
      stdout: "docker exec -it -w /root/foo container-foo-abc12345 /bin/bash\n",
      stderr: "",
    });
    stopContainerIfLastSession("container-foo-abc12345", "foo");
    const calls = spawnSync.__getCalls();
    const stopCall = calls.find(c => c.args && c.args[0] === "stop");
    expect(stopCall).toBeUndefined();
  });
});

describe("createNewContainer", () => {
  it("constructs correct docker run arguments", () => {
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    createNewContainer("container-foo-abc12345", "foo", "/home/user/foo");

    const calls = spawnSync.__getCalls();
    const runCall = calls[calls.length - 1];
    expect(runCall.command).toBe("docker");
    expect(runCall.args[0]).toBe("run");
    expect(runCall.args).toContain("-d");
    expect(runCall.args).toContain("--name");
    expect(runCall.args).toContain("container-foo-abc12345");
    expect(runCall.args).toContain("-e");
    expect(runCall.args).toContain("TERM=xterm-256color");
    expect(runCall.args).toContain("-w");
    expect(runCall.args).toContain("/root/foo");
    expect(runCall.args).toContain("-v");
    expect(runCall.args).toContain("/home/user/foo:/root/foo");
    expect(runCall.args[runCall.args.length - 3]).toBe("code-container:latest");
    expect(runCall.args[runCall.args.length - 2]).toBe("sleep");
    expect(runCall.args[runCall.args.length - 1]).toBe("infinity");
  });

  it("includes cliFlags in the argument list", () => {
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    createNewContainer("container-foo-abc12345", "foo", "/home/user/foo", [
      "-p",
      "8080:80",
    ]);

    const calls = spawnSync.__getCalls();
    const runCall = calls[calls.length - 1];
    expect(runCall.args).toContain("-p");
    expect(runCall.args).toContain("8080:80");
  });

  it("returns true on success", () => {
    spawnSync.__enqueue({ status: 0, stdout: "", stderr: "" });
    expect(createNewContainer("c", "p", "/path")).toBe(true);
  });

  it("returns false on failure", () => {
    spawnSync.__enqueue({ status: 1, stdout: "", stderr: "" });
    expect(createNewContainer("c", "p", "/path")).toBe(false);
  });
});
