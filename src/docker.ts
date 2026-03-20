import { spawnSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { printInfo, printError } from "./utils";
import { APPDATA_DIR, DOCKERFILE_PATH } from "./config";
import { loadMounts } from "./mounts";
import { loadFlags } from "./flags";

export const IMAGE_NAME = "code-container";
export const IMAGE_TAG = "latest";
const PACKAGED_DOCKERFILE = path.resolve(__dirname, "..", "Dockerfile");
const CONTAINER_PREFIX = "container";

export function checkDocker(): void {
  const result = spawnSync("docker", ["info"], { stdio: "pipe" });
  if (result.status !== 0) {
    printError(
      "Docker is not available. Please install Docker: https://docs.docker.com/get-docker/"
    );
    process.exit(1);
  }
}

export function getMounts(projectPath: string, projectName: string): string[] {
  const mounts: string[] = [];
  mounts.push(`${projectPath}:/root/${projectName}`);
  const fileMounts = loadMounts();
  mounts.push(...fileMounts);
  return mounts;
}

export function generateContainerName(projectPath: string): string {
  const normalizedPath = projectPath.replace(/\/$/, "");
  const projectName = path.basename(normalizedPath);
  const pathHash = crypto
    .createHash("sha1")
    .update(normalizedPath)
    .digest("hex")
    .substring(0, 8);
  return `${CONTAINER_PREFIX}-${projectName}-${pathHash}`;
}

export function imageExists(): boolean {
  const result = spawnSync(
    "docker",
    ["image", "inspect", `${IMAGE_NAME}:${IMAGE_TAG}`],
    { stdio: "pipe" }
  );
  return result.status === 0;
}

export function ensureDockerfile(): void {
  if (!fs.existsSync(DOCKERFILE_PATH)) {
    if (fs.existsSync(PACKAGED_DOCKERFILE)) {
      printInfo(
        `Dockerfile not found at ${DOCKERFILE_PATH}, copying from package...`
      );
      fs.copyFileSync(PACKAGED_DOCKERFILE, DOCKERFILE_PATH);
    } else {
      throw new Error(
        `Dockerfile not found at ${DOCKERFILE_PATH} and no packaged Dockerfile available`
      );
    }
  }
}

export function buildImageRaw(): boolean {
  ensureDockerfile();
  const result = spawnSync(
    "docker",
    ["build", "-t", `${IMAGE_NAME}:${IMAGE_TAG}`, APPDATA_DIR],
    { stdio: "inherit" }
  );
  return result.status === 0;
}

export function containerExists(containerName: string): boolean {
  const result = spawnSync("docker", ["container", "inspect", containerName], {
    stdio: "pipe",
  });
  return result.status === 0;
}

export function containerRunning(containerName: string): boolean {
  const result = spawnSync(
    "docker",
    ["container", "inspect", "-f", "{{.State.Running}}", containerName],
    { stdio: "pipe" }
  );
  return result.status === 0 && result.stdout.toString().trim() === "true";
}

export function stopContainer(containerName: string): void {
  spawnSync("docker", ["stop", "--timeout", "3", containerName], { stdio: "inherit" });
}

export function startContainer(containerName: string): void {
  spawnSync("docker", ["start", containerName], { stdio: "inherit" });
}

export function removeContainer(containerName: string): void {
  spawnSync("docker", ["rm", containerName], { stdio: "inherit" });
}

export function createNewContainer(
  containerName: string,
  projectName: string,
  projectPath: string
): boolean {
  const mounts = getMounts(projectPath, projectName);
  const args = ["run", "-d", "--name", containerName];

  args.push("-e", "TERM=xterm-256color");
  args.push("-w", `/root/${projectName}`);

  for (const mount of mounts) {
    args.push("-v", mount);
  }

  const flags = loadFlags();
  args.push(...flags);

  args.push(`${IMAGE_NAME}:${IMAGE_TAG}`, "sleep", "infinity");

  const result = spawnSync("docker", args, { stdio: "inherit" });
  return result.status === 0;
}

export function execInteractive(
  containerName: string,
  projectName: string
): void {
  spawnSync(
    "docker",
    [
      "exec",
      "-it",
      "-e",
      "TERM=xterm-256color",
      "-w",
      `/root/${projectName}`,
      containerName,
      "/bin/bash",
    ],
    { stdio: "inherit" }
  );
}

export function getOtherSessionCount(
  containerName: string,
  projectName: string
): number {
  const result = spawnSync("ps", ["ax", "-o", "command="], {
    encoding: "utf-8",
  });
  if (result.status !== 0) return 0;

  const lines = result.stdout.split("\n");
  let count = 0;

  for (const line of lines) {
    const hasDockerExec = line.includes("docker exec");
    const hasIt = line.includes("-it");
    const hasContainerName = line.includes(containerName);
    const hasBash = line.includes("/bin/bash");
    const hasWorkdir = line.includes(`-w /root/${projectName}`);

    if (hasDockerExec && hasIt && hasContainerName && hasBash && hasWorkdir) {
      count++;
    }
  }

  return count;
}

export function stopContainerIfLastSession(
  containerName: string,
  projectName: string
): void {
  const otherSessions = getOtherSessionCount(containerName, projectName);
  if (otherSessions === 0) {
    stopContainer(containerName);
  } else {
    printInfo(
      `Skipping stop; ${otherSessions} other terminal(s) still attached`
    );
  }
}

export function listContainersRaw(): void {
  spawnSync(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      `name=${CONTAINER_PREFIX}-`,
      "--format",
      "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}",
    ],
    { stdio: "inherit" }
  );
}

export function getStoppedContainerIds(): string[] {
  const result = spawnSync(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      `name=${CONTAINER_PREFIX}-`,
      "--filter",
      "status=exited",
      "--quiet",
    ],
    { encoding: "utf8" }
  );

  const containerIds = result.stdout.trim();
  if (!containerIds) return [];

  return containerIds.split("\n");
}

export function removeContainersById(ids: string[]): void {
  spawnSync("docker", ["rm", ...ids], { stdio: "inherit" });
}
