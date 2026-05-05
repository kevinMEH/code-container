interface SpawnSyncOptions {
  encoding?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

interface SpawnSyncResult {
  status: number | null;
  stdout: string | Buffer;
  stderr: string | Buffer;
}

interface CallRecord {
  command: string;
  args: ReadonlyArray<string>;
  options?: SpawnSyncOptions;
}

const calls: CallRecord[] = [];
const queue: SpawnSyncResult[] = [];

function spawnSync(
  command: string,
  args: ReadonlyArray<string>,
  options?: SpawnSyncOptions,
): SpawnSyncResult {
  calls.push({ command, args, options });
  if (queue.length > 0) {
    return queue.shift()!;
  }
  return { status: 0, stdout: "", stderr: "" };
}

function enqueue(result: SpawnSyncResult): void {
  queue.push(result);
}

function getCalls(): CallRecord[] {
  return calls;
}

function reset(): void {
  calls.length = 0;
  queue.length = 0;
}

function getQueueLength(): number {
  return queue.length;
}

export { spawnSync, enqueue, getCalls, reset, getQueueLength };
