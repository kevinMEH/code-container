import * as path from "path";
import * as fs from "fs";
import { printInfo, printSuccess, printWarning, printError } from "./utils";
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
  ensureSharedDirs,
  listContainersRaw,
  getStoppedContainerIds,
  removeContainersById,
} from "./docker";

export function buildImage(scriptDir: string): void {
  printInfo("Building Docker image: code:latest");
  if (!buildImageRaw(scriptDir)) {
    printError("Failed to build Docker image");
    process.exit(1);
  }
  printSuccess("Docker image built successfully");
}

export function runContainer(projectPath: string, scriptDir: string): void {
  const containerName = generateContainerName(projectPath);
  const projectName = path.basename(projectPath);

  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    printError(`Project directory does not exist or is not a directory: ${projectPath}`);
    process.exit(1);
  }

  ensureSharedDirs(scriptDir);

  if (!imageExists()) {
    printWarning("Docker image not found. Building...");
    buildImage(scriptDir);
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
  printInfo(`Project: ${projectPath} ~/${projectName}`);

  if (!createNewContainer(containerName, projectName, projectPath, scriptDir)) {
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