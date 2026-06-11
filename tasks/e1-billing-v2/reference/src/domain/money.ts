// Integer-cents arithmetic. Half-even rounding and largest-remainder allocation are the
// only sanctioned rounding/splitting primitives in the engine (I-ROUND, I-ALLOC).

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

// Splits total proportionally to non-negative integer weights using the largest-remainder
// method: floor each proportional share, then hand out the remaining cents one at a time
// in descending remainder order (ties broken by lowest index). Deterministic.
export function allocateLargestRemainder(total: number, weights: number[]): number[] {
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

  const shares = weights.map((weight) => Math.floor((total * weight) / weightSum));
  let leftover = total - shares.reduce((sum, share) => sum + share, 0);
  const order = weights
    .map((weight, index) => ({ index, remainder: (total * weight) % weightSum }))
    .toSorted((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let cursor = 0; leftover > 0; cursor = (cursor + 1) % order.length) {
    shares[order[cursor].index] += 1;
    leftover -= 1;
  }

  return shares;
}
