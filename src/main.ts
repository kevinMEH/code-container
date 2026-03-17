#!/usr/bin/env node

import { printError, printInfo, promptYesNo, resolveProjectPath } from "./utils";
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

function usage(): void {
  console.log(`
Usage: container [COMMAND] [PROJECT_PATH]

Manage Code containers for isolated project environments.

Commands:
    (none)         Start container for current directory (default)
    run            Start container for specified project path
    build          Build the Docker image
    init           Copy config files from home directory
    stop           Stop the container for this project
    remove         Remove the container for this project
    list           List all Code containers
    clean          Remove all stopped Code containers

Arguments:
    PROJECT_PATH    Path to the project directory (defaults to current directory)

Examples:
    container                           # Start container for current directory
    container run /path/to/project      # Start container for specific project
    container build                     # Build Docker image
    container init                      # Copy config files
    container stop                      # Stop container for current directory
    container remove /path/to/project   # Remove container for specific project
    container list                      # List all containers
    container clean                     # Clean up stopped containers
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let command = "";
  let projectPath = "";

  if (args.length > 0) {
    const firstArg = args[0];
    if (firstArg === "help" || firstArg === "--help" || firstArg === "-h") {
      usage();
    }

    const validCommands = [
      "run",
      "build",
      "init",
      "stop",
      "remove",
      "list",
      "clean",
    ];
    if (validCommands.includes(firstArg)) {
      command = firstArg;
      if (args.length > 1) {
        projectPath = args[1];
      }
      if (args.length > 2) {
        printError(`Unexpected argument: ${args[2]}`);
        usage();
      }
    } else {
      printError(`Unknown command: ${firstArg}`);
      usage();
    }
  }

  if (!await ensureTosAccepted()) {
    printInfo("Terms not accepted. Exiting...");
    process.exit(1);
  }

  if (command === "init") {
    await init();
    return;
  }

  checkDocker();
  await init(true);
  const resolvedPath = resolveProjectPath(projectPath);

  switch (command) {
    case "list":
      listContainers();
      return;
    case "clean":
      cleanContainers();
      return;
    case "build":
      buildImage();
      return;
    case "stop":
      stopContainerForProject(resolvedPath);
      return;
    case "remove":
      removeContainerForProject(resolvedPath);
      return;
    case "run":
    case "":
      await runContainer(resolvedPath);
      return;
  }
}

main();
