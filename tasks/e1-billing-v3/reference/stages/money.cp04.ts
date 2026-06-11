// Integer-cents arithmetic. Half-even rounding is the only sanctioned rounding
// primitive in the engine (I-ROUND).

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
