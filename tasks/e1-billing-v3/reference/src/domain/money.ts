// Integer-cents arithmetic. Half-even rounding and largest-remainder allocation are the
// only sanctioned rounding/splitting primitives in the engine (I-ROUND, I-ALLOC). The
// allocator is a generalized weighted primitive exposing its full trace (CP17); the
// numeric shares are frozen behavior and must never change.

export function assertIntegerCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be integer cents, got ${String(value)}`);
  }
}

// Rounds numerator/denominator to the nearest integer, ties to even (banker's rounding).
// Negative numerators round symmetrically on magnitude.
export function roundHalfEvenRatio(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator)) {
    throw new Error(`roundHalfEvenRatio numerator must be an integer, got ${String(numerator)}`);
  }

  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error(`roundHalfEvenRatio denominator must be a positive integer, got ${String(denominator)}`);
  }

  const negative = numerator < 0;
  const magnitude = Math.abs(numerator);
  const quotient = Math.floor(magnitude / denominator);
  const twiceRemainder = 2 * (magnitude - quotient * denominator);
  const roundedUp = twiceRemainder > denominator || (twiceRemainder === denominator && quotient % 2 === 1);
  const rounded = roundedUp ? quotient + 1 : quotient;

  return negative ? -rounded : rounded;
}

// amount * multiplier / divisor, rounded half-even.
export function mulDivHalfEven(amount: number, multiplier: number, divisor: number): number {
  assertIntegerCents(amount, "mulDivHalfEven amount");
  assertIntegerCents(multiplier, "mulDivHalfEven multiplier");

  return roundHalfEvenRatio(amount * multiplier, divisor);
}

// One allocation step, fully explained: floor share, raw remainder (the descending sort
// key), how many leftover cents the round-robin handed this weight, and the final share.
export type AllocationPart = {
  index: number;
  weight: number;
  floor_cents: number;
  remainder: number;
  extra_cents: number;
  share_cents: number;
};

// Splits total proportionally to non-negative integer weights using the largest-remainder
// method: floor each proportional share, then hand out the remaining cents one at a time
// in descending remainder order (ties broken by lowest index), wrapping around if the
// leftover exceeds the weight count. Deterministic. Returns the shares plus the full
// per-weight trace.
export function allocateLargestRemainderTrace(
  total: number,
  weights: number[]
): { shares: number[]; parts: AllocationPart[] } {
  assertIntegerCents(total, "allocateLargestRemainder total");

  if (total < 0) {
    throw new Error("allocateLargestRemainder total must be non-negative");
  }

  const weightSum = weights.reduce((sum, weight) => {
    assertIntegerCents(weight, "allocateLargestRemainder weight");

    if (weight < 0) {
      throw new Error("allocateLargestRemainder weights must be non-negative");
    }

    return sum + weight;
  }, 0);

  if (weightSum <= 0) {
    throw new Error("allocateLargestRemainder requires a positive weight sum");
  }

  const floors = weights.map((weight) => Math.floor((total * weight) / weightSum));
  const remainders = weights.map((weight) => (total * weight) % weightSum);
  const extras = weights.map(() => 0);
  let leftover = total - floors.reduce((sum, share) => sum + share, 0);
  const order = weights
    .map((weight, index) => ({ index, remainder: remainders[index] }))
    .toSorted((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let cursor = 0; leftover > 0; cursor = (cursor + 1) % order.length) {
    extras[order[cursor].index] += 1;
    leftover -= 1;
  }

  const parts = weights.map((weight, index) => ({
    index,
    weight,
    floor_cents: floors[index],
    remainder: remainders[index],
    extra_cents: extras[index],
    share_cents: floors[index] + extras[index]
  }));

  return { shares: parts.map((part) => part.share_cents), parts };
}

// Frozen shares-only entry point: every existing caller allocates through this.
export function allocateLargestRemainder(total: number, weights: number[]): number[] {
  return allocateLargestRemainderTrace(total, weights).shares;
}
