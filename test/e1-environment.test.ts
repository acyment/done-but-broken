import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateE1DependencyLockfileBoundary } from "../src/e1-environment";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 dependency lockfile boundary", () => {
  test("allows the historical zero-dependency state without bun.lock", async () => {
    const root = await setupPackage({ dependencies: {} });

    await expect(validateE1DependencyLockfileBoundary(root)).resolves.toBeUndefined();
  });

  test("rejects missing bun.lock after the first declared dependency", async () => {
    const root = await setupPackage({ dependencies: { "js-tiktoken": "^1.0.21" } });

    await expect(validateE1DependencyLockfileBoundary(root)).rejects.toThrow("bun.lock is required");
  });

  test("rejects stale bun.lock that omits declared dependencies", async () => {
    const root = await setupPackage({ dependencies: { "js-tiktoken": "^1.0.21" } });
    await writeFile(join(root, "bun.lock"), "{\"packages\":{}}\n");

    await expect(validateE1DependencyLockfileBoundary(root)).rejects.toThrow("stale");
  });

  test("accepts a lockfile that contains every declared dependency entry", async () => {
    const root = await setupPackage({ dependencies: { "js-tiktoken": "^1.0.21" } });
    await writeFile(
      join(root, "bun.lock"),
      [
        "{",
        '  "workspaces": { "": { "dependencies": { "js-tiktoken": "^1.0.21" } } },',
        '  "packages": { "js-tiktoken": ["js-tiktoken@1.0.21", "", {}, "sha512-test"] }',
        "}",
        ""
      ].join("\n")
    );

    await expect(validateE1DependencyLockfileBoundary(root)).resolves.toBeUndefined();
  });
});

async function setupPackage(input: { dependencies: Record<string, string> }): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-env-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({ type: "module", dependencies: input.dependencies }, null, 2)}\n`
  );

  return root;
}
