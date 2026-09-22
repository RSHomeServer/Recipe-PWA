import type { MeasureKind } from "./schemas";

/** Tolerances in canonical units — absorbs float residue, not real-world slack. */
export const EPSILON: Record<MeasureKind, number> = {
  mass: 1e-4,
  volume: 1e-4,
  count: 1e-6,
};

export function isShort(
  required: number,
  available: number,
  kind: MeasureKind,
): boolean {
  return required - available > EPSILON[kind];
}

export function isEnough(
  required: number,
  available: number,
  kind: MeasureKind,
): boolean {
  return required - available <= EPSILON[kind];
}

export function isZero(amount: number, kind: MeasureKind): boolean {
  return Math.abs(amount) <= EPSILON[kind];
}

/** Compare two amounts within the family epsilon. */
export function withinTolerance(
  a: number,
  b: number,
  kind: MeasureKind,
): boolean {
  return Math.abs(a - b) <= EPSILON[kind];
}
