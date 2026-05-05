import * as fs from "fs";
import { parse } from "shell-quote";

import { FLAGS_PATH, RUN_FLAGS_PATH } from "./config";
import { printError } from "./utils";

export enum FlagSource {
  Common = "common",
  Run = "run",
}

function loadFlagsFromPath(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const flags: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const parts = parse(trimmed);
    const lineFlags: string[] = [];
    let hasOperator = false;

    for (const part of parts) {
      if (typeof part === "string") {
        lineFlags.push(part);
      } else {
        hasOperator = true;
        break;
      }
    }

    if (hasOperator) {
      printError("Invalid Docker flag line: shell operators are not allowed.");
      printError(`Argument skipped: ${line}`);
      continue;
    }

    flags.push(...lineFlags);
  }

  return flags;
}

export function loadFlags(source: FlagSource): string[] {
  const filePath = source === FlagSource.Run ? RUN_FLAGS_PATH : FLAGS_PATH;
  return loadFlagsFromPath(filePath);
}
