import path from "path";
import fs from "fs";
import {
  printInfo,
  printSuccess,
  printWarning,
  printError,
  promptYesNo,
} from "./utils";
import {
  generateContainerName,
  imageExists,
  buildImageRaw,
  containerExists,
  containerRunning,
  stopContainer,
  startContainer,
  removeContainer,
  createNewContainer,
  execInteractive,
  stopContainerIfLastSession,
  listContainersRaw,
  getStoppedContainerIds,
  removeContainersById,
  IMAGE_NAME,
  IMAGE_TAG,
  BuildTarget,
} from "./docker";
import {
  ensureConfigDir,
  loadSettings,
  saveSettings,
  copyConfigs,
  HARNESS_LIST,
} from "./config";

export async function buildImage(target: BuildTarget): Promise<void> {
  const settings = loadSettings();
  const uid = settings.containerUid;
  const gid = settings.containerGid;

  let selectedHarnesses = settings.selectedHarnesses;
  if (selectedHarnesses.length === 0) {
    printInfo("No harnesses selected. Please choose which to install:");
    selectedHarnesses = [];
    for (const harness of HARNESS_LIST) {
      const install = await promptYesNo(`Install ${harness}?`);
      if (install) selectedHarnesses.push(harness);
    }
    settings.selectedHarnesses = selectedHarnesses;
    saveSettings(settings);
  }

  printInfo(`Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}`);
  if (!buildImageRaw(target, uid, gid, selectedHarnesses)) {
    printError("Failed to build Docker image");
    process.exit(1);
  }
  printSuccess("Docker image built successfully");
}

export async function init(isStartup: boolean = false): Promise<void> {
  const settings = loadSettings();

  if (isStartup) {
    // If startup: Check if completedInit, if not, prompt.
    if (!settings.completedInit) {
      printInfo("First run detected. Would you like to copy config files?");
      printInfo(
        "This will copy your OpenCode, Codex, Claude Code, & Gemini CLI configs to ~/.code-container/configs for mounting.",
      );
      printInfo(
        "If you choose to not copy config files, you can still setup your harness once inside the container.",
      );

      const shouldCopy = await promptYesNo("Copy config files?");
      if (shouldCopy) {
        copyConfigs();
        printSuccess("Config files copied successfully");
      } else {
        printInfo("Ignoring copy. Run `container init` to copy.");
      }
    }
    settings.completedInit = true;
    saveSettings(settings);
  } else {
    // Else, not startup; user ran container init
    if (!settings.completedInit) {
      printInfo("Copying config files to ~/.code-container/configs...");
      copyConfigs();
      printSuccess("Config files copied successfully");

      settings.completedInit = true;
      saveSettings(settings);
    } else {
      printWarning(
        "Config files already exist. This operation will merge and overwrite existing config files.",
      );
      const shouldCopy = await promptYesNo("Continue?");
      if (shouldCopy) {
        copyConfigs();
        printSuccess("Config files copied successfully");
      }
    }
  }
}

export async function runContainer(
  projectPath: string,
  cliFlags: string[] = [],
): Promise<void> {
  const containerName = generateContainerName(projectPath);
  const projectName = path.basename(projectPath);

  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    printError(
      `Project directory does not exist or is not a directory: ${projectPath}`,
    );
    process.exit(1);
  }

  ensureConfigDir();

  if (!imageExists()) {
    printWarning("Docker image not found. Building...");
    await buildImage("full");
  }

  if (containerRunning(containerName)) {
    printInfo(`Container '${containerName}' is already running`);
    printInfo("Attaching to container...");
    execInteractive(containerName, projectName);
    stopContainerIfLastSession(containerName, projectName);
    return;
  }

  if (containerExists(containerName)) {
    printInfo(`Starting existing container: ${containerName}`);
    startContainer(containerName);
    execInteractive(containerName, projectName);
    stopContainerIfLastSession(containerName, projectName);
    return;
  }

  printInfo(`Creating new container: ${containerName}`);
  printInfo(`Project: ${projectPath}`);

  if (!createNewContainer(containerName, projectName, projectPath, cliFlags)) {
    printError("Failed to create container");
    process.exit(1);
  }

  execInteractive(containerName, projectName);
  stopContainerIfLastSession(containerName, projectName);
  printSuccess("Container session ended");
}

export function stopContainerForProject(projectPath: string): void {
  const containerName = generateContainerName(projectPath);

  if (!containerExists(containerName)) {
    printError(`Container does not exist: ${containerName}`);
    process.exit(1);
  }

  if (containerRunning(containerName)) {
    printInfo(`Stopping container: ${containerName}`);
    stopContainer(containerName);
    printSuccess("Container stopped");
  } else {
    printWarning(`Container is not running: ${containerName}`);
  }
}

export function removeContainerForProject(projectPath: string): void {
  const containerName = generateContainerName(projectPath);

  if (!containerExists(containerName)) {
    printError(`Container does not exist: ${containerName}`);
    process.exit(1);
  }

  if (containerRunning(containerName)) {
    printInfo(`Stopping container: ${containerName}`);
    stopContainer(containerName);
  }

  printInfo(`Removing container: ${containerName}`);
  removeContainer(containerName);
  printSuccess("Container removed");
}

export function listContainers(): void {
  printInfo("Code Containers:");
  listContainersRaw();
}

export function cleanContainers(): void {
  printInfo("Removing all stopped Code containers...");
  const containerIds = getStoppedContainerIds();

  if (containerIds.length === 0) {
    printInfo("No stopped Code containers to remove");
    return;
  }

  removeContainersById(containerIds);
  printSuccess("Cleanup complete");
}
