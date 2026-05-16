import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { printInfo, printError } from "./utils";
import {
  APPDATA_DIR,
  USER_DOCKERFILE_PATH,
  PACKAGES_DOCKERFILE_PATH,
} from "./config";
import { loadMounts } from "./mounts";
import { loadFlags, FlagSource } from "./flags";

export const IMAGE_NAME = "code-container";
export const IMAGE_TAG = "latest";
const CORE_IMAGE = "code-container-core";
const PACKAGES_IMAGE = "code-container-packages";
const BASE_IMAGE = "code-container-base";
export type BuildTarget = "full" | "packages" | "harness" | "user";

export const CONTAINER_USER = "developer";

const RESOURCES_DIR = path.resolve(__dirname, "..", "resources");
const CORE_DOCKERFILE = path.join(RESOURCES_DIR, "Dockerfile.Core");
const HARNESS_DOCKERFILE = path.join(RESOURCES_DIR, "Dockerfile.Harness");
const PACKAGED_PACKAGES_DOCKERFILE = path.join(
  RESOURCES_DIR,
  "Dockerfile.Packages",
);
const PACKAGED_USER_DOCKERFILE = path.join(RESOURCES_DIR, "Dockerfile.User");

interface BuildStage {
  dockerfile: string;
  tag: string;
  isUserFile: boolean;
  packagedSource?: string;
}

const BUILD_STAGES: BuildStage[] = [
  {
    dockerfile: CORE_DOCKERFILE,
    tag: CORE_IMAGE,
    isUserFile: false,
  },
  {
    dockerfile: PACKAGES_DOCKERFILE_PATH,
    tag: PACKAGES_IMAGE,
    isUserFile: true,
    packagedSource: PACKAGED_PACKAGES_DOCKERFILE,
  },
  {
    dockerfile: HARNESS_DOCKERFILE,
    tag: BASE_IMAGE,
    isUserFile: false,
  },
  {
    dockerfile: USER_DOCKERFILE_PATH,
    tag: IMAGE_NAME,
    isUserFile: true,
    packagedSource: PACKAGED_USER_DOCKERFILE,
  },
];

const BUILD_START_INDEX: Record<BuildTarget, number> = {
  full: 0,
  packages: 1,
  harness: 2,
  user: 3,
};

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
  mounts.push(`${projectPath}:/home/${CONTAINER_USER}/${projectName}`);
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

function ensureUserDockerfile(filePath: string, packagedSource: string): void {
  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(packagedSource)) {
      printInfo(`Dockerfile not found at ${filePath}, copying from package...`);
      fs.copyFileSync(packagedSource, filePath);
    } else {
      throw new Error(
        `Dockerfile not found at ${filePath} and no packaged default available`,
      );
    }
  }
}

export function buildImageRaw(
  target: BuildTarget,
  uid: number,
  gid: number,
): boolean {
  const startIndex = BUILD_START_INDEX[target];

  for (let i = startIndex; i < BUILD_STAGES.length; i++) {
    const stage = BUILD_STAGES[i];
    printInfo(`Building: ${stage.tag}`);

    if (stage.isUserFile && stage.packagedSource) {
      ensureUserDockerfile(stage.dockerfile, stage.packagedSource);
    }

    const dockerArgs = [
      "build",
      "--no-cache",
      "-t",
      `${stage.tag}:${IMAGE_TAG}`,
      "-f",
      stage.dockerfile,
    ];

    if (i === 0) {
      dockerArgs.push("--build-arg", `CONTAINER_UID=${uid}`);
      dockerArgs.push("--build-arg", `CONTAINER_GID=${gid}`);
    }

    dockerArgs.push(APPDATA_DIR);

    const result = spawnSync("docker", dockerArgs, { stdio: "inherit" });
    if (result.status !== 0) return false;
  }

  return true;
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
  args.push("--user", CONTAINER_USER);
  args.push("-w", `/home/${CONTAINER_USER}/${projectName}`);

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

export function getContainerUser(containerName: string): string {
  const result = spawnSync(
    "docker",
    ["container", "inspect", "-f", "{{.Config.User}}", containerName],
    { stdio: "pipe", encoding: "utf-8" },
  );
  return result.status === 0 ? result.stdout.trim() : "";
}

export function execInteractive(
  containerName: string,
  projectName: string,
): void {
  const user = getContainerUser(containerName) || "root";
  const homeDir = user === CONTAINER_USER ? `/home/${CONTAINER_USER}` : "/root";
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
      "--user",
      user,
      "-w",
      `${homeDir}/${projectName}`,
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
    const hasWorkdir =
      line.includes(`-w /home/${CONTAINER_USER}/${projectName}`) ||
      line.includes(`-w /root/${projectName}`);

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
