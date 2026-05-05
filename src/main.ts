#!/usr/bin/env node

import { printInfo, promptYesNo, resolveProjectPath } from "./utils";
import {
  buildImage,
  runContainer,
  stopContainerForProject,
  removeContainerForProject,
  listContainers,
  cleanContainers,
  init,
} from "./commands";
import { checkDocker } from "./docker";
import { loadSettings, saveSettings } from "./config";
import { ensureMountsFile } from "./mounts";
import { parseArgs } from "./args";

const TOS = `
\x1b[33m⚠️  Security Advisory:\x1b[0m

The main purpose of Code Container is to protect commands like 'rm' or 'apt'
from unintentionally affecting your main system.

container does not protect from prompt injections in the event that an agent
becomes malaligned.

This is an innate problem within coding harness software and container does
not attempt to solve it.

Users are advised to not download or work with unverified software.
- Sensitive information inside the container may still be exfiltrated by
  an attacker just as with your regular system.
  - This includes:
  - OAuth credentials inside harness configs
  - API keys inside harness configs
  - SSH keys for git functionality if enabled

Never install or run your harness on unverified software. By using Code
Container, you agree that you are aware of these risks and will not hold the
author liable for any outcomes arising from usage of the software.
`;

async function ensureTosAccepted(): Promise<boolean> {
  const settings = loadSettings();
  if (settings.acceptedTos) {
    return true;
  }

  console.log(TOS);
  const accepted = await promptYesNo("Do you accept these terms?");
  if (accepted) {
    settings.acceptedTos = true;
    saveSettings(settings);
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (!(await ensureTosAccepted())) {
    printInfo("Terms not accepted. Exiting...");
    process.exit(1);
  }

  await ensureMountsFile();

  if (parsed.command === "init") {
    await init();
    return;
  }

  checkDocker();
  await init(true);

  switch (parsed.command) {
    case "list":
      listContainers();
      return;
    case "clean":
      cleanContainers();
      return;
    case "build":
      buildImage(parsed.target);
      return;
    case "stop": {
      const resolved = resolveProjectPath(parsed.projectPath);
      stopContainerForProject(resolved);
      return;
    }
    case "remove": {
      const resolved = resolveProjectPath(parsed.projectPath);
      removeContainerForProject(resolved);
      return;
    }
    case "run": {
      const resolved = resolveProjectPath(parsed.projectPath);
      await runContainer(resolved, parsed.cliFlags);
      return;
    }
  }
}

main();
