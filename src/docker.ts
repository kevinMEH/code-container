import { spawnSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { printInfo, printWarning } from "./utils";

const IMAGE_NAME = "code";
const IMAGE_TAG = "latest";

export const SHARED_DIRS = [
  ".claude",
  ".codex",
  ".local",
  ".opencode",
  ".gemini",
];

export const MOUNT_SOURCES = [
  ".claude:/root/.claude",
  "container.claude.json:/root/.claude.json",
  ".codex:/root/.codex",
  ".opencode:/root/.config/opencode",
  ".gemini:/root/.gemini",
  ".local:/root/.local",
] as const;

export function getMounts(
  projectPath: string,
  projectName: string,
  scriptDir: string
): string[] {
  const home = process.env.HOME || "";
  const mounts: string[] = [];

  mounts.push(`${projectPath}:/root/${projectName}`);

  for (const src of MOUNT_SOURCES) {
    mounts.push(`${scriptDir}/${src}`);
  }

  mounts.push(`${home}/.gitconfig:/root/.gitconfig:ro`);
  mounts.push(`${home}/.ssh:/root/.ssh:ro`);

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
  return `code-${projectName}-${pathHash}`;
}

export function imageExists(): boolean {
  const result = spawnSync(
    "docker",
    ["image", "inspect", `${IMAGE_NAME}:${IMAGE_TAG}`],
    { stdio: "pipe" }
  );
  return result.status === 0;
}

export function buildImageRaw(scriptDir: string): boolean {
  const result = spawnSync(
    "docker",
    ["build", "-t", `${IMAGE_NAME}:${IMAGE_TAG}`, scriptDir],
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
  spawnSync("docker", ["stop", containerName], { stdio: "inherit" });
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
  scriptDir: string
): boolean {
  const mounts = getMounts(projectPath, projectName, scriptDir);
  const args = ["run", "-d", "--name", containerName];

  args.push("-e", "TERM=xterm-256color");
  args.push("-w", `/root/${projectName}`);

  for (const mount of mounts) {
    args.push("-v", mount);
  }

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

export function ensureSharedDirs(scriptDir: string): void {
  for (const dir of SHARED_DIRS) {
    const fullPath = path.join(scriptDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  const claudeJsonPath = path.join(scriptDir, "container.claude.json");
  if (!fs.existsSync(claudeJsonPath)) {
    printWarning(`Missing ${claudeJsonPath}; creating default file`);
    fs.writeFileSync(claudeJsonPath, "{}");
  }
}

export function listContainersRaw(): void {
  spawnSync(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      "name=code-",
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
      "name=code-",
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
