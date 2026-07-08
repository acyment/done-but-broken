// Deterministic RNG (architecture §4): a small pure PRNG seeded by substrate_seed; no
// Math.random anywhere in the generator. mulberry32 — tiny, well-known, fully deterministic given
// its 32-bit integer seed.
export type E4Prng = {
  next(): number; // [0, 1)
  nextInt(maxExclusive: number): number; // integer in [0, maxExclusive)
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[]; // deterministic Fisher-Yates using this PRNG
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createE4Prng(seed: number): E4Prng {
  const next = mulberry32(seed);

  const prng: E4Prng = {
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`nextInt requires a positive integer bound, got ${maxExclusive}`);
      }

      return Math.floor(next() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError("pick requires a non-empty array");
      }

      return items[prng.nextInt(items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];

      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = prng.nextInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
      }

      return result;
    }
  };

  return prng;
}
