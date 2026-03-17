#!/usr/bin/env node

import { printError, resolveProjectPath } from "./utils";
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
