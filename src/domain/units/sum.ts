import type { CanonicalQuantity, MeasureKind } from "./schemas";

export function zeroQuantity(kind: MeasureKind): CanonicalQuantity {
  return { amount: 0, kind };
}

/**
 * Sum canonical quantities of one family.
 * Empty list → zero of `kind` (required so the result has a defined family).
 * Mixed families are a programming error and throw.
 */
export function sumQuantities(
  qs: readonly CanonicalQuantity[],
  kind: MeasureKind,
): CanonicalQuantity {
  for (const q of qs) {
    if (q.kind !== kind) {
      throw new Error(
        `sumQuantities: expected kind ${kind}, got ${q.kind}`,
      );
    }
  }
  return {
    amount: qs.reduce((acc, q) => acc + q.amount, 0),
    kind,
  };
}
