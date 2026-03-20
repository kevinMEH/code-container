import * as fs from "fs";
import { FLAGS_PATH } from "./config";

export function loadFlags(): string[] {
  if (!fs.existsSync(FLAGS_PATH)) {
    return [];
  }
  const content = fs.readFileSync(FLAGS_PATH, "utf-8");
  const flags: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    flags.push(...parts);
  }

  return flags;
}
