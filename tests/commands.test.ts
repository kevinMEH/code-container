import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";

vi.mock("fs", () => {
  const existsSync = vi.fn(() => true);
  const statSync = vi.fn(() => ({ isDirectory: () => true }));
  return {
    default: { existsSync, statSync },
    existsSync,
    statSync,
  };
});

vi.mock("child_process");

vi.mock("../src/docker", () => ({
  generateContainerName: vi.fn(() => "container-test-abc12345"),
  imageExists: vi.fn(() => true),
  buildImageRaw: vi.fn(() => true),
  containerExists: vi.fn(() => false),
  containerRunning: vi.fn(() => false),
  stopContainer: vi.fn(),
  startContainer: vi.fn(),
  removeContainer: vi.fn(),
  createNewContainer: vi.fn(() => true),
  execInteractive: vi.fn(),
  stopContainerIfLastSession: vi.fn(),
  listContainersRaw: vi.fn(),
  getStoppedContainerIds: vi.fn(() => []),
  removeContainersById: vi.fn(),
  IMAGE_NAME: "code-container",
  IMAGE_TAG: "latest",
}));

vi.mock("../src/config", () => ({
  ensureConfigDir: vi.fn(),
  loadSettings: vi.fn(() => ({ completedInit: false, acceptedTos: false })),
  saveSettings: vi.fn(),
  copyConfigs: vi.fn(),
}));

vi.mock("../src/utils", () => ({
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
  printError: vi.fn(),
  promptYesNo: vi.fn(() => Promise.resolve(true)),
}));

import {
  buildImage,
  init,
  runContainer,
  stopContainerForProject,
  removeContainerForProject,
  listContainers,
  cleanContainers,
} from "../src/commands";

import {
  imageExists,
  buildImageRaw,
  containerExists,
  containerRunning,
  stopContainer,
  startContainer,
  removeContainer,
  createNewContainer,
  execInteractive,
  listContainersRaw,
  getStoppedContainerIds,
  removeContainersById,
} from "../src/docker";
import { loadSettings, saveSettings, copyConfigs } from "../src/config";
import {
  printInfo,
  printSuccess,
  printWarning,
  promptYesNo,
} from "../src/utils";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildImage", () => {
  it("builds full target", () => {
    buildImage("full");
    expect(buildImageRaw).toHaveBeenCalledWith("full");
    expect(printSuccess).toHaveBeenCalled();
  });

  it("builds packages target", () => {
    buildImage("packages");
    expect(buildImageRaw).toHaveBeenCalledWith("packages");
  });

  it("builds harness target", () => {
    buildImage("harness");
    expect(buildImageRaw).toHaveBeenCalledWith("harness");
  });

  it("builds user target", () => {
    buildImage("user");
    expect(buildImageRaw).toHaveBeenCalledWith("user");
  });

  it("calls process.exit on build failure", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    vi.mocked(buildImageRaw).mockReturnValueOnce(false);
    expect(() => buildImage("full")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(buildImageRaw).toHaveBeenCalledWith("full");
    exitSpy.mockRestore();
  });
});

describe("init", () => {
  it("startup + not completedInit + user yes → copies configs", async () => {
    vi.mocked(promptYesNo).mockResolvedValueOnce(true);
    await init(true);
    expect(copyConfigs).toHaveBeenCalled();
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ completedInit: true }),
    );
  });

  it("startup + not completedInit + user no → skips configs", async () => {
    vi.mocked(promptYesNo).mockResolvedValueOnce(false);
    await init(true);
    expect(copyConfigs).not.toHaveBeenCalled();
    expect(saveSettings).toHaveBeenCalled();
  });

  it("startup + completedInit → skips prompt, saves settings", async () => {
    vi.mocked(loadSettings).mockReturnValueOnce({
      completedInit: true,
      acceptedTos: false,
    });
    await init(true);
    expect(promptYesNo).not.toHaveBeenCalled();
    expect(copyConfigs).not.toHaveBeenCalled();
    expect(saveSettings).toHaveBeenCalled();
  });

  it("manual + not completedInit → always copies", async () => {
    vi.mocked(loadSettings).mockReturnValueOnce({
      completedInit: false,
      acceptedTos: false,
    });
    await init(false);
    expect(copyConfigs).toHaveBeenCalled();
    expect(promptYesNo).not.toHaveBeenCalled();
  });

  it("manual + completedInit + user yes → overwrites", async () => {
    vi.mocked(loadSettings).mockReturnValueOnce({
      completedInit: true,
      acceptedTos: false,
    });
    vi.mocked(promptYesNo).mockResolvedValueOnce(true);
    await init(false);
    expect(copyConfigs).toHaveBeenCalled();
  });
});

describe("runContainer", () => {
  const projectPath = "/home/user/test-project";

  it("exits when project path does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    await expect(runContainer("/nonexistent")).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("attaches to running container without creating", async () => {
    vi.mocked(containerRunning).mockReturnValueOnce(true);
    await runContainer(projectPath);
    expect(execInteractive).toHaveBeenCalledWith(
      "container-test-abc12345",
      "test-project",
    );
    expect(createNewContainer).not.toHaveBeenCalled();
    expect(startContainer).not.toHaveBeenCalled();
  });

  it("starts existing stopped container then attaches", async () => {
    vi.mocked(containerExists).mockReturnValueOnce(true);
    await runContainer(projectPath);
    expect(startContainer).toHaveBeenCalledWith("container-test-abc12345");
    expect(execInteractive).toHaveBeenCalled();
    expect(createNewContainer).not.toHaveBeenCalled();
  });

  it("creates new container when none exists", async () => {
    await runContainer(projectPath);
    expect(createNewContainer).toHaveBeenCalledWith(
      "container-test-abc12345",
      "test-project",
      projectPath,
      [],
    );
    expect(execInteractive).toHaveBeenCalled();
  });

  it("builds image when image does not exist", async () => {
    vi.mocked(imageExists).mockReturnValueOnce(false);
    await runContainer(projectPath);
    expect(buildImageRaw).toHaveBeenCalled();
  });

  it("exits when createNewContainer fails", async () => {
    vi.mocked(createNewContainer).mockReturnValueOnce(false);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    await expect(runContainer(projectPath)).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("passes cliFlags to createNewContainer", async () => {
    await runContainer(projectPath, ["-p", "8080:80"]);
    expect(createNewContainer).toHaveBeenCalledWith(
      "container-test-abc12345",
      "test-project",
      projectPath,
      ["-p", "8080:80"],
    );
  });
});

describe("stopContainerForProject", () => {
  it("exits when container does not exist", () => {
    vi.mocked(containerExists).mockReturnValueOnce(false);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    expect(() => stopContainerForProject("/path")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("stops running container", () => {
    vi.mocked(containerExists).mockReturnValueOnce(true);
    vi.mocked(containerRunning).mockReturnValueOnce(true);
    stopContainerForProject("/path");
    expect(stopContainer).toHaveBeenCalledWith("container-test-abc12345");
  });

  it("warns when container is not running", () => {
    vi.mocked(containerExists).mockReturnValueOnce(true);
    vi.mocked(containerRunning).mockReturnValueOnce(false);
    stopContainerForProject("/path");
    expect(stopContainer).not.toHaveBeenCalled();
    expect(printWarning).toHaveBeenCalled();
  });
});

describe("removeContainerForProject", () => {
  it("exits when container does not exist", () => {
    vi.mocked(containerExists).mockReturnValueOnce(false);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    expect(() => removeContainerForProject("/path")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("stops then removes running container", () => {
    vi.mocked(containerExists).mockReturnValueOnce(true);
    vi.mocked(containerRunning).mockReturnValueOnce(true);
    removeContainerForProject("/path");
    expect(stopContainer).toHaveBeenCalledWith("container-test-abc12345");
    expect(removeContainer).toHaveBeenCalledWith("container-test-abc12345");
  });

  it("removes non-running container without stopping", () => {
    vi.mocked(containerExists).mockReturnValueOnce(true);
    vi.mocked(containerRunning).mockReturnValueOnce(false);
    removeContainerForProject("/path");
    expect(stopContainer).not.toHaveBeenCalled();
    expect(removeContainer).toHaveBeenCalledWith("container-test-abc12345");
  });
});

describe("listContainers", () => {
  it("delegates to listContainersRaw", () => {
    listContainers();
    expect(listContainersRaw).toHaveBeenCalled();
  });
});

describe("cleanContainers", () => {
  it("prints info and returns when no stopped containers", () => {
    vi.mocked(getStoppedContainerIds).mockReturnValueOnce([]);
    cleanContainers();
    expect(getStoppedContainerIds).toHaveBeenCalled();
    expect(removeContainersById).not.toHaveBeenCalled();
    expect(printInfo).toHaveBeenCalledWith(
      expect.stringContaining("No stopped"),
    );
  });

  it("removes stopped containers and prints success", () => {
    vi.mocked(getStoppedContainerIds).mockReturnValueOnce(["abc123", "def456"]);
    cleanContainers();
    expect(getStoppedContainerIds).toHaveBeenCalled();
    expect(removeContainersById).toHaveBeenCalledWith(["abc123", "def456"]);
    expect(removeContainersById).toHaveBeenCalledTimes(1);
    expect(printSuccess).toHaveBeenCalledWith("Cleanup complete");
  });
});
