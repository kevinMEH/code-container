import { spawnSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { printInfo, printError } from "./utils";
import { APPDATA_DIR, USER_DOCKERFILE_PATH } from "./config";
import { loadMounts } from "./mounts";
import { loadFlags, FlagSource } from "./flags";

export const IMAGE_NAME = "code-container";
export const IMAGE_TAG = "latest";
export const BASE_IMAGE = "code-container-base";
const PACKAGED_DOCKERFILE = path.resolve(__dirname, "..", "Dockerfile");
const PACKAGED_USER_DOCKERFILE = path.resolve(
  __dirname,
  "..",
  "Dockerfile.User",
);
const CONTAINER_PREFIX = "container";

export function checkDocker(): void {
  const result = spawnSync("docker", ["info"], { stdio: "pipe" });
  if (result.status !== 0) {
    printError(
      "Docker is not available. Please install Docker: https://docs.docker.com/get-docker/",
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
    { stdio: "pipe" },
  );
  return result.status === 0;
}

export function ensureDockerfile(): void {
  if (!fs.existsSync(USER_DOCKERFILE_PATH)) {
    if (fs.existsSync(PACKAGED_USER_DOCKERFILE)) {
      printInfo(
        `Dockerfile.User not found at ${USER_DOCKERFILE_PATH}, copying from package...`,
      );
      fs.copyFileSync(PACKAGED_USER_DOCKERFILE, USER_DOCKERFILE_PATH);
    } else {
      throw new Error(
        `Dockerfile.User not found at ${USER_DOCKERFILE_PATH} and no packaged Dockerfile.User available`,
      );
    }
  }
}

export function buildImageRaw(): boolean {
  const baseResult = spawnSync(
    "docker",
    [
      "build",
      "--no-cache",
      "-t",
      `${BASE_IMAGE}:${IMAGE_TAG}`,
      "-f",
      PACKAGED_DOCKERFILE,
      APPDATA_DIR,
    ],
    { stdio: "inherit" },
  );
  if (baseResult.status !== 0) return false;

  ensureDockerfile();

  const userResult = spawnSync(
    "docker",
    [
      "build",
      "--no-cache",
      "-f",
      USER_DOCKERFILE_PATH,
      "-t",
      `${IMAGE_NAME}:${IMAGE_TAG}`,
      APPDATA_DIR,
    ],
    { stdio: "inherit" },
  );
  return userResult.status === 0;
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
    { stdio: "pipe" },
  );
  return result.status === 0 && result.stdout.toString().trim() === "true";
}

export function stopContainer(containerName: string): void {
  spawnSync("docker", ["stop", "-t", "3", containerName], { stdio: "inherit" });
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
  projectPath: string,
  cliFlags: string[] = [],
): boolean {
  const mounts = getMounts(projectPath, projectName);
  const args = ["run", "-d", "--name", containerName];

  args.push("-e", "TERM=xterm-256color");
  args.push("-e", "COLORTERM=truecolor");
  args.push("-w", `/root/${projectName}`);

  for (const mount of mounts) {
    args.push("-v", mount);
  }

  const flags = loadFlags(FlagSource.Common);
  const runFlags = loadFlags(FlagSource.Run);
  args.push(...flags);
  args.push(...runFlags);
  args.push(...cliFlags);

  args.push(`${IMAGE_NAME}:${IMAGE_TAG}`, "sleep", "infinity");

  const result = spawnSync("docker", args, { stdio: "inherit" });
  return result.status === 0;
}

export function execInteractive(
  containerName: string,
  projectName: string,
): void {
  const flags = loadFlags(FlagSource.Common);
  spawnSync(
    "docker",
    [
      "exec",
      "-it",
      "-e",
      "TERM=xterm-256color",
      "-e",
      "COLORTERM=truecolor",
      "-w",
      `/root/${projectName}`,
      ...flags,
      containerName,
      "/bin/bash",
    ],
    { stdio: "inherit" },
  );
}

export function getOtherSessionCount(
  containerName: string,
  projectName: string,
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
  projectName: string,
): void {
  const otherSessions = getOtherSessionCount(containerName, projectName);
  if (otherSessions === 0) {
    stopContainer(containerName);
  } else {
    printInfo(
      `Skipping stop; ${otherSessions} other terminal(s) still attached`,
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
    { stdio: "inherit" },
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
    { encoding: "utf8" },
  );

  const containerIds = result.stdout.trim();
  if (!containerIds) return [];

  return containerIds.split("\n");
}

export function removeContainersById(ids: string[]): void {
  spawnSync("docker", ["rm", ...ids], { stdio: "inherit" });
}
