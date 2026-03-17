import * as fs from "fs";
import * as os from "os";
import { CONFIGS_DIR, MOUNTS_PATH, ensureAppdataDir } from "./config";
import { printInfo, promptYesNo } from "./utils";

function getCoreMounts(): string[] {
  const home = os.homedir();
  return [
    `${CONFIGS_DIR}/.claude:/root/.claude`,
    `${CONFIGS_DIR}/.claude.json:/root/.claude.json`,
    `${CONFIGS_DIR}/.codex:/root/.codex`,
    `${CONFIGS_DIR}/.opencode:/root/.config/opencode`,
    `${CONFIGS_DIR}/.gemini:/root/.gemini`,
    `${CONFIGS_DIR}/.local:/root/.local`,
    `${home}/.gitconfig:/root/.gitconfig:ro`,
  ];
}

export async function ensureMountsFile(): Promise<void> {
  if (fs.existsSync(MOUNTS_PATH)) {
    return;
  }

  ensureAppdataDir();
  const home = os.homedir();
  const mounts: string[] = [...getCoreMounts()];

  printInfo("");
  printInfo("MOUNTS.txt not found. Setting up default mount points.");
  printInfo("");
  printInfo("Would you like to mount ~/.ssh (read-only)?");
  printInfo(
    "  Pros: Enables SSH-based git operations and remote server access inside the container. (E.g.: git push, git pull)"
  );
  printInfo(
    "  Risks: Exposes your SSH private keys. Only enable if you trust the code running in your containers."
  );
  printInfo(
    "  Note: This configuration is global. You may modify your mounts at any time by editing ~/.code-container/MOUNTS.txt."
  );

  const mountSsh = await promptYesNo("Mount ~/.ssh?");
  if (mountSsh) {
    mounts.push(`${home}/.ssh:/root/.ssh:ro`);
  }

  fs.writeFileSync(MOUNTS_PATH, mounts.join("\n") + "\n", { mode: 0o600 });
  printInfo("");
  printInfo(`Created ${MOUNTS_PATH}`);
  printInfo("You can edit this file to customize mount points.");
}

export function loadMounts(): string[] {
  if (!fs.existsSync(MOUNTS_PATH)) {
    return [];
  }
  const content = fs.readFileSync(MOUNTS_PATH, "utf-8");
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
}
