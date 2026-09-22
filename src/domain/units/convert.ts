import type {
  CanonicalQuantity,
  MeasureKind,
  MeasureKindBearer,
  Quantity,
  Unit,
} from "./schemas";
import { UNITS, unitsForKind } from "./table";

export type Validated =
  | { ok: true; canonical: CanonicalQuantity }
  | {
      ok: false;
      reason: "wrongFamily";
      expected: MeasureKind;
      allowed: Unit[];
    };

export type ValidatedQuantity =
  | { ok: true; quantity: Quantity }
  | {
      ok: false;
      reason: "wrongFamily";
      expected: MeasureKind;
      allowed: Unit[];
    };

function expectedKindOf(
  ingredientOrKind: MeasureKindBearer | MeasureKind,
): MeasureKind {
  return typeof ingredientOrKind === "string"
    ? ingredientOrKind
    : ingredientOrKind.measureKind;
}

/**
 * Convert a user quantity into the ingredient's canonical unit.
 * Cross-family input returns `{ ok: false, reason: "wrongFamily" }` — never throws,
 * never fabricates a number.
 */
export function toCanonical(
  q: Quantity,
  ingredientOrKind: MeasureKindBearer | MeasureKind,
): Validated {
  const expected = expectedKindOf(ingredientOrKind);
  const def = UNITS[q.unit];
  if (def.kind !== expected) {
    return {
      ok: false,
      reason: "wrongFamily",
      expected,
      allowed: unitsForKind(expected),
    };
  }
  return {
    ok: true,
    canonical: { amount: q.value * def.toCanonical, kind: expected },
  };
}

/**
 * Express a canonical quantity in a display unit of the same family.
 */
export function fromCanonical(
  canonical: CanonicalQuantity,
  unit: Unit,
): ValidatedQuantity {
  const def = UNITS[unit];
  if (def.kind !== canonical.kind) {
    return {
      ok: false,
      reason: "wrongFamily",
      expected: canonical.kind,
      allowed: unitsForKind(canonical.kind),
    };
  }
  return {
    ok: true,
    quantity: { value: canonical.amount / def.toCanonical, unit },
  };
}
