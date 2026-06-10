const checkpoint = process.argv.find((arg) => arg.startsWith("--cp="))?.slice("--cp=".length) ?? "3";

if (!["1", "2", "3"].includes(checkpoint)) {
  throw new Error(`Unknown checkpoint: ${checkpoint}`);
}

await import("./steps/cartcalc.cp1.spec.ts");

if (checkpoint === "2" || checkpoint === "3") {
  await import("./steps/cartcalc.cp2.spec.ts");
}

if (checkpoint === "3") {
  await import("./steps/cartcalc.cp3.spec.ts");
}
