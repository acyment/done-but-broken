import { readFile } from "node:fs/promises";
import { join } from "node:path";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export async function validateE1DependencyLockfileBoundary(projectRoot: string): Promise<void> {
  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as PackageJson;
  const dependencyNames = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  }).sort();

  if (dependencyNames.length === 0) {
    return;
  }

  let lockfile: string;

  try {
    lockfile = await readFile(join(projectRoot, "bun.lock"), "utf8");
  } catch {
    throw new Error("bun.lock is required once package.json declares dependencies");
  }

  const missing = dependencyNames.filter((name) => !lockfileIncludesDependency(lockfile, name));

  if (missing.length) {
    throw new Error(`bun.lock is stale or missing dependency entries: ${missing.join(", ")}`);
  }
}

function lockfileIncludesDependency(lockfile: string, dependencyName: string): boolean {
  const escaped = escapeRegExp(dependencyName);

  return (
    new RegExp(`"${escaped}"\\s*:`).test(lockfile) &&
    new RegExp(`"${escaped}"\\s*:\\s*\\["${escaped}@`).test(lockfile)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
