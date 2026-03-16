#!/usr/bin/env node

import * as path from "path";
import { printError, resolveProjectPath } from "./utils";
import {
  buildImage,
  runContainer,
  stopContainerForProject,
  removeContainerForProject,
  listContainers,
  cleanContainers,
} from "./commands";

const SCRIPT_PATH = __dirname;
const SCRIPT_DIR = path.resolve(SCRIPT_PATH, "..");

function usage(): void {
  console.log(`
Usage: container [COMMAND] [PROJECT_PATH]

Manage Code containers for isolated project environments.

Commands:
    (none)         Start container for current directory (default)
    run            Start container for specified project path
    build          Build the Docker image
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
    container stop                      # Stop container for current directory
    container remove /path/to/project   # Remove container for specific project
    container list                      # List all containers
    container clean                     # Clean up stopped containers
`);
  process.exit(0);
}

function main(): void {
  const args = process.argv.slice(2);
  let command = "";
  let projectPath = "";

  if (args.length > 0) {
    const firstArg = args[0];
    if (firstArg === "help" || firstArg === "--help" || firstArg === "-h") {
      usage();
    }

    const validCommands = ["run", "build", "stop", "remove", "list", "clean"];
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

  if (command === "list") {
    listContainers();
    process.exit(0);
  }

  if (command === "clean") {
    cleanContainers();
    process.exit(0);
  }

  if (command === "build") {
    buildImage(SCRIPT_DIR);
    process.exit(0);
  }

  const resolvedPath = resolveProjectPath(projectPath);

  switch (command) {
    case "stop":
      stopContainerForProject(resolvedPath);
      break;
    case "remove":
      removeContainerForProject(resolvedPath);
      break;
    case "run":
    case "":
      runContainer(resolvedPath, SCRIPT_DIR);
      break;
  }
}

main();
