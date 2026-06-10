import { execFile, type ExecFileOptions } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function execFileWithSpawnRetry(
  file: string,
  args: string[],
  options: ExecFileOptions,
  maxAttempts = 4
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await execFileAsync(file, args, options);
    } catch (error) {
      if (!isSpawnEagain(error) || attempt >= maxAttempts) {
        throw error;
      }

      await sleep(attempt * 100);
    }
  }
}

function isSpawnEagain(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "EAGAIN";
}
