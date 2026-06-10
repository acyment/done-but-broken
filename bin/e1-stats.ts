import { readFile } from "node:fs/promises";
import {
  extractE1ConditionBundles,
  renderE1StatsLines,
  summarizeE1Stats
} from "../src/e1-stats";

async function main(): Promise<void> {
  const paths = process.argv.slice(2).filter((arg) => arg !== "--");

  if (paths.length === 0 || paths.includes("--help")) {
    console.log("Usage: bun run e1:stats -- <bundle.json> [more-bundles.json...]");
    console.log(
      "Reads E1 provider/no-provider bundles and prints the Step 0 required measurements as key=value lines."
    );
    process.exit(paths.length === 0 ? 1 : 0);
  }

  const conditionBundles = [];

  for (const path of paths) {
    const bundle = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    conditionBundles.push(extractE1ConditionBundles(bundle));
    const identity = bundle.run_identity as Record<string, unknown> | undefined;
    console.log(
      `bundle=${path} schema=${String(bundle.schema_version)} grade=${String(bundle.grade ?? "n/a")} model=${String(
        identity?.provider_model ?? identity?.model ?? "n/a"
      )} prompt_template_hash=${String(identity?.prompt_template_hash ?? "n/a")}`
    );
  }

  for (const line of renderE1StatsLines(summarizeE1Stats(conditionBundles))) {
    console.log(line);
  }
}

await main();
