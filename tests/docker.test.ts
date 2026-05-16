import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs, { vol } from "memfs";
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
  buildImageRaw,
  getContainerUser,
} from "../src/docker";

vi.mock("fs");
vi.mock("child_process");
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
  vol.reset();
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

describe("getContainerUser", () => {
  it("returns empty string when container not found", () => {
    enqueue({ status: 1, stdout: "", stderr: "" });
    expect(getContainerUser("container-foo-abc12345")).toBe("");
  });

  it("returns configured user for container", () => {
    enqueue({ status: 0, stdout: "developer\n", stderr: "" });
    expect(getContainerUser("container-foo-abc12345")).toBe("developer");
  });

  it("returns empty string for root (old containers)", () => {
    enqueue({ status: 0, stdout: "\n", stderr: "" });
    expect(getContainerUser("container-foo-abc12345")).toBe("");
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
        "docker exec -it --user developer -w /home/developer/foo container-foo-abc12345 /bin/bash\n" +
        "docker exec -it --user developer -w /home/developer/foo container-foo-abc12345 /bin/bash\n" +
        "some other process\n",
      stderr: "",
    });
    expect(getOtherSessionCount("container-foo-abc12345", "foo")).toBe(2);
  });

  it("counts old container sessions with /root/ workdir", () => {
    enqueue({
      status: 0,
      stdout:
        "docker exec -it --user root -w /root/foo container-foo-abc12345 /bin/bash\n",
      stderr: "",
    });
    expect(getOtherSessionCount("container-foo-abc12345", "foo")).toBe(1);
  });

  it("does not count non-matching sessions", () => {
    enqueue({
      status: 0,
      stdout:
        "docker exec -it --user developer -w /home/developer/bar container-bar-xyz /bin/bash\n" +
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
      stdout:
        "docker exec -it --user developer -w /home/developer/foo container-foo-abc12345 /bin/bash\n",
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
    expect(runCall.args).toContain("--user");
    expect(runCall.args).toContain("developer");
    expect(runCall.args).toContain("-w");
    expect(runCall.args).toContain("/home/developer/foo");
    expect(runCall.args).toContain("-v");
    expect(runCall.args).toContain("/home/user/foo:/home/developer/foo");
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

function enqueueSuccessfulBuilds(count: number): void {
  for (let i = 0; i < count; i++) {
    enqueue({ status: 0, stdout: "", stderr: "" });
  }
}

function getBuildCalls(): Array<{
  dockerfile: string;
  tag: string;
  args: string[];
}> {
  return getCalls()
    .filter((c) => c.args && c.args[0] === "build")
    .map((c) => {
      const args = c.args!;
      const fIdx = args.indexOf("-f");
      const tIdx = args.indexOf("-t");
      return {
        dockerfile: fIdx !== -1 ? args[fIdx + 1] : "",
        tag: tIdx !== -1 ? args[tIdx + 1] : "",
        args: [...args],
      };
    });
}

describe("buildImageRaw", () => {
  const resourcesDir = path.resolve(__dirname, "..", "resources");
  const coreDockerfile = path.join(resourcesDir, "Dockerfile.Core");
  const harnessDockerfile = path.join(resourcesDir, "Dockerfile.Harness");

  function seedPackagedDockerfiles(): void {
    vol.fromJSON(
      {
        "Dockerfile.Core": "FROM ubuntu:24.04",
        "Dockerfile.Harness": "FROM code-container-packages:latest",
        "Dockerfile.Packages": "FROM code-container-core:latest",
        "Dockerfile.User": "FROM code-container-base:latest",
      },
      resourcesDir,
    );
  }

  function seedUserDockerfiles(): void {
    const appdataDir = path.join(os.homedir(), ".code-container");
    vol.fromJSON(
      {
        "Dockerfile.Packages": "FROM code-container-core:latest",
        "Dockerfile.User": "FROM code-container-base:latest",
      },
      appdataDir,
    );
  }

  function seedAllDockerfiles(): void {
    seedPackagedDockerfiles();
    seedUserDockerfiles();
  }

  describe("full target", () => {
    it("builds all 4 stages", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      const result = buildImageRaw("full", 1000, 1001, []);
      expect(result).toBe(true);

      const builds = getBuildCalls();
      expect(builds).toHaveLength(4);
    });

    it("passes --no-cache to every stage", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, []);

      const builds = getBuildCalls();
      for (const build of builds) {
        expect(build.args).toContain("--no-cache");
      }
    });

    it("uses correct dockerfile and tag for each stage", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, []);

      const builds = getBuildCalls();
      expect(builds[0].dockerfile).toBe(coreDockerfile);
      expect(builds[0].tag).toBe("code-container-core:latest");

      expect(builds[1].dockerfile).toContain("Dockerfile.Packages");
      expect(builds[1].tag).toBe("code-container-packages:latest");

      expect(builds[2].dockerfile).toBe(harnessDockerfile);
      expect(builds[2].tag).toBe("code-container-base:latest");

      expect(builds[3].dockerfile).toContain("Dockerfile.User");
      expect(builds[3].tag).toBe("code-container:latest");
    });

    it("passes UID/GID build args to core stage (index 0)", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, []);

      const builds = getBuildCalls();
      const coreArgs = builds[0].args;
      expect(coreArgs).toContain("--build-arg");
      expect(coreArgs).toContain("CONTAINER_UID=1000");
      expect(coreArgs).toContain("CONTAINER_GID=1001");
    });

    it("does not pass UID/GID args to non-core stages", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, []);

      const builds = getBuildCalls();
      for (let i = 1; i < builds.length; i++) {
        expect(builds[i].args).not.toContain("CONTAINER_UID");
        expect(builds[i].args).not.toContain("CONTAINER_GID");
      }
    });

    it("passes harness build args to harness stage (index 2)", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, ["opencode", "gemini"]);

      const builds = getBuildCalls();
      const harnessArgs = builds[2].args;
      expect(harnessArgs).toContain("--build-arg");
      expect(harnessArgs).toContain("INSTALL_CLAUDE=false");
      expect(harnessArgs).toContain("INSTALL_OPENCODE=true");
      expect(harnessArgs).toContain("INSTALL_CODEX=false");
      expect(harnessArgs).toContain("INSTALL_GEMINI=true");
      expect(harnessArgs).toContain("INSTALL_COPILOT=false");
    });

    it("passes CONTAINER_USER to harness stage", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, []);

      const builds = getBuildCalls();
      const harnessArgs = builds[2].args;
      expect(harnessArgs).toContain("--build-arg");
      expect(harnessArgs).toContain("CONTAINER_USER=developer");
    });

    it("does not pass harness args to non-harness stages", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, ["opencode"]);

      const builds = getBuildCalls();
      for (let i = 0; i < builds.length; i++) {
        if (i === 2) continue;
        expect(builds[i].args).not.toContain("INSTALL_CLAUDE");
        expect(builds[i].args).not.toContain("INSTALL_OPENCODE");
      }
    });

    it("uses APPDATA_DIR as build context for every stage", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(4);
      buildImageRaw("full", 1000, 1001, []);

      const builds = getBuildCalls();
      for (const build of builds) {
        expect(build.args[build.args.length - 1]).toContain(".code-container");
      }
    });
  });

  describe("packages target", () => {
    it("builds 3 stages (packages, harness, user)", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(3);
      const result = buildImageRaw("packages", 1000, 1001, []);
      expect(result).toBe(true);

      const builds = getBuildCalls();
      expect(builds).toHaveLength(3);
      expect(builds[0].tag).toBe("code-container-packages:latest");
      expect(builds[1].tag).toBe("code-container-base:latest");
      expect(builds[2].tag).toBe("code-container:latest");
    });

    it("does not build core stage", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(3);
      buildImageRaw("packages", 1000, 1001, []);

      const builds = getBuildCalls();
      const coreBuild = builds.find((b) => b.dockerfile === coreDockerfile);
      expect(coreBuild).toBeUndefined();
    });
  });

  describe("harness target", () => {
    it("builds 2 stages (harness, user)", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(2);
      const result = buildImageRaw("harness", 1000, 1001, []);
      expect(result).toBe(true);

      const builds = getBuildCalls();
      expect(builds).toHaveLength(2);
      expect(builds[0].tag).toBe("code-container-base:latest");
      expect(builds[1].tag).toBe("code-container:latest");
    });

    it("does not build core or packages stages", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(2);
      buildImageRaw("harness", 1000, 1001, []);

      const builds = getBuildCalls();
      const coreBuild = builds.find((b) => b.dockerfile === coreDockerfile);
      const packagesBuild = builds.find((b) =>
        b.dockerfile.includes("Dockerfile.Packages"),
      );
      expect(coreBuild).toBeUndefined();
      expect(packagesBuild).toBeUndefined();
    });
  });

  describe("user target", () => {
    it("builds only the user stage", () => {
      seedAllDockerfiles();
      enqueue({ status: 0, stdout: "", stderr: "" });
      const result = buildImageRaw("user", 1000, 1001, []);
      expect(result).toBe(true);

      const builds = getBuildCalls();
      expect(builds).toHaveLength(1);
      expect(builds[0].tag).toBe("code-container:latest");
      expect(builds[0].dockerfile).toContain("Dockerfile.User");
    });
  });

  describe("failure handling", () => {
    it("returns false when core stage fails", () => {
      seedAllDockerfiles();
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("full", 1000, 1001, [])).toBe(false);
      expect(getBuildCalls()).toHaveLength(1);
    });

    it("returns false when packages stage fails", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(1);
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("full", 1000, 1001, [])).toBe(false);
      expect(getBuildCalls()).toHaveLength(2);
    });

    it("returns false when harness stage fails", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(2);
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("full", 1000, 1001, [])).toBe(false);
      expect(getBuildCalls()).toHaveLength(3);
    });

    it("returns false when user stage fails", () => {
      seedAllDockerfiles();
      enqueueSuccessfulBuilds(3);
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("full", 1000, 1001, [])).toBe(false);
      expect(getBuildCalls()).toHaveLength(4);
    });

    it("does not continue building after a failure", () => {
      seedAllDockerfiles();
      enqueue({ status: 1, stdout: "", stderr: "" });
      buildImageRaw("full", 1000, 1001, []);
      expect(getBuildCalls()).toHaveLength(1);
    });

    it("packages target fails at first stage", () => {
      seedAllDockerfiles();
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("packages", 1000, 1001, [])).toBe(false);
      expect(getBuildCalls()).toHaveLength(1);
    });

    it("harness target fails at first stage", () => {
      seedAllDockerfiles();
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("harness", 1000, 1001, [])).toBe(false);
      expect(getBuildCalls()).toHaveLength(1);
    });

    it("user target fails", () => {
      seedAllDockerfiles();
      enqueue({ status: 1, stdout: "", stderr: "" });
      expect(buildImageRaw("user", 1000, 1001, [])).toBe(false);
    });
  });

  describe("ensureUserDockerfile", () => {
    it("copies Dockerfile.Packages from packaged source when missing", () => {
      seedPackagedDockerfiles();
      // @ts-expect-error memfs runtime has mkdirSync but types don't expose it
      fs.mkdirSync(path.join(os.homedir(), ".code-container"), {
        recursive: true,
      });
      enqueueSuccessfulBuilds(1);

      buildImageRaw("packages", 1000, 1001, []);

      expect(
        // @ts-expect-error memfs runtime has existsSync but types don't expose it
        fs.existsSync(
          path.join(os.homedir(), ".code-container", "Dockerfile.Packages"),
        ),
      ).toBe(true);
    });

    it("copies Dockerfile.User from packaged source when missing", () => {
      seedPackagedDockerfiles();
      // @ts-expect-error memfs runtime has mkdirSync but types don't expose it
      fs.mkdirSync(path.join(os.homedir(), ".code-container"), {
        recursive: true,
      });
      enqueueSuccessfulBuilds(1);

      buildImageRaw("user", 1000, 1001, []);

      expect(
        // @ts-expect-error memfs runtime has existsSync but types don't expose it
        fs.existsSync(
          path.join(os.homedir(), ".code-container", "Dockerfile.User"),
        ),
      ).toBe(true);
    });

    it("throws when user dockerfile and packaged source both missing", () => {
      expect(() => buildImageRaw("user", 1000, 1001, [])).toThrow(
        "Dockerfile not found",
      );
    });

    it("does not copy when user dockerfile already exists", () => {
      seedPackagedDockerfiles();
      seedUserDockerfiles();
      enqueueSuccessfulBuilds(1);

      // @ts-expect-error memfs runtime has readFileSync but types don't expose it
      const contentBefore = fs.readFileSync(
        path.join(os.homedir(), ".code-container", "Dockerfile.User"),
        "utf-8",
      );
      buildImageRaw("user", 1000, 1001, []);
      // @ts-expect-error memfs runtime has readFileSync but types don't expose it
      const contentAfter = fs.readFileSync(
        path.join(os.homedir(), ".code-container", "Dockerfile.User"),
        "utf-8",
      );
      expect(contentBefore).toBe(contentAfter);
    });
  });
});
