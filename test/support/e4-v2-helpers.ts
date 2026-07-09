// Shared helpers for the v2-M0+ test files. The index-queue PRNG makes op application fully
// explicit in census/unit tests: each queued value is consumed by exactly one nextInt(max) call
// (ops only ever draw via prng.pick → nextInt), so a test names the entity/field/target variant
// it means to exercise and fails loudly if the op's draw order ever changes.
import type { E4Prng } from "../../src/e4/substrate/prng";

export function indexQueuePrng(indices: number[]): E4Prng {
  const queue = [...indices];

  const nextInt = (maxExclusive: number): number => {
    const value = queue.shift();

    if (value === undefined) {
      throw new Error("indexQueuePrng: queue exhausted — the op made more draws than the test planned");
    }

    if (!Number.isInteger(value) || value < 0 || value >= maxExclusive) {
      throw new Error(`indexQueuePrng: queued index ${value} out of range [0, ${maxExclusive})`);
    }

    return value;
  };

  return {
    next: () => {
      throw new Error("indexQueuePrng: raw next() draws are not plannable — use pick/nextInt paths only");
    },
    nextInt,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError("pick requires a non-empty array");
      }
      return items[nextInt(items.length)];
    },
    shuffle: () => {
      throw new Error("indexQueuePrng: shuffle is not plannable");
    }
  };
}
