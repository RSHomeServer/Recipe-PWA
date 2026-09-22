import type { MeasureKind, Unit } from "./schemas";

export type UnitDef = {
  readonly kind: MeasureKind;
  /** Multiply `value` by this to get the canonical amount. */
  readonly toCanonical: number;
  readonly label: string;
};

export const UNITS = {
  g: { kind: "mass", toCanonical: 1, label: "g" },
  kg: { kind: "mass", toCanonical: 1000, label: "kg" },
  ml: { kind: "volume", toCanonical: 1, label: "ml" },
  L: { kind: "volume", toCanonical: 1000, label: "L" },
  item: { kind: "count", toCanonical: 1, label: "×" },
} as const satisfies Record<Unit, UnitDef>;

export const CANONICAL_UNIT: Record<MeasureKind, Unit> = {
  mass: "g",
  volume: "ml",
  count: "item",
};

export function unitsForKind(kind: MeasureKind): Unit[] {
  return (Object.keys(UNITS) as Unit[]).filter((u) => UNITS[u].kind === kind);
}
