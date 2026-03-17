import * as path from "path";
import * as readline from "readline";

export function printInfo(message: string): void {
  console.log(`\x1b[34m[INFO]\x1b[0m ${message}`);
}

export function printSuccess(message: string): void {
  console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`);
}

export function printWarning(message: string): void {
  console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`);
}

export function printError(message: string): void {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
}

export function resolveProjectPath(projectPath: string | undefined): string {
  if (!projectPath) {
    return process.cwd();
  }

  return path.resolve(projectPath);
}

export function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
