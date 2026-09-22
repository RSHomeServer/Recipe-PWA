import type { CanonicalQuantity, Unit } from "./schemas";
import { fromCanonical } from "./convert";
import { CANONICAL_UNIT, UNITS } from "./table";

export type FormatQuantityOptions = {
  /** Prefer this unit when it is in-family (recipe lines). */
  displayUnit?: Unit;
  /** Optional noun for count display, e.g. "eggs" → "3 eggs". */
  countLabel?: string;
};

function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

function formatFixed(value: number, maxDp: number): string {
  const rounded = Number(value.toFixed(maxDp));
  return trimTrailingZeros(rounded.toFixed(maxDp));
}

function formatSigned(
  amount: number,
  formatAbs: (abs: number) => string,
): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatAbs(Math.abs(amount))}`;
}

function formatMassAuto(amount: number): string {
  return formatSigned(amount, (abs) => {
    if (abs >= 1000) {
      return `${formatFixed(abs / 1000, 2)} kg`;
    }
    if (abs >= 100) {
      return `${Math.round(abs)} g`;
    }
    return `${formatFixed(abs, 1)} g`;
  });
}

function formatVolumeAuto(amount: number): string {
  return formatSigned(amount, (abs) => {
    if (abs >= 1000) {
      return `${formatFixed(abs / 1000, 2)} L`;
    }
    return `${Math.round(abs)} ml`;
  });
}

function formatCountAuto(amount: number, countLabel?: string): string {
  return formatSigned(amount, (abs) => {
    const body =
      Math.abs(abs - Math.round(abs)) < 1e-9
        ? String(Math.round(abs))
        : formatFixed(abs, 4);
    return countLabel ? `${body} ${countLabel}` : body;
  });
}

function formatInUnit(
  amount: number,
  unit: Unit,
  countLabel?: string,
): string {
  const value = amount / UNITS[unit].toCanonical;
  if (unit === "item") {
    return formatCountAuto(value, countLabel);
  }
  return formatSigned(value, (abs) => {
    const maxDp = unit === "kg" || unit === "L" ? 2 : abs < 100 ? 1 : 0;
    const body =
      maxDp === 0 ? String(Math.round(abs)) : formatFixed(abs, maxDp);
    return `${body} ${UNITS[unit].label}`;
  });
}

/**
 * Format a canonical quantity for display.
 * Negatives keep their sign; amounts are never clamped.
 */
export function formatQuantity(
  q: CanonicalQuantity,
  options: FormatQuantityOptions = {},
): string {
  const { displayUnit, countLabel } = options;
  if (displayUnit !== undefined) {
    const converted = fromCanonical(q, displayUnit);
    if (converted.ok) {
      return formatInUnit(q.amount, displayUnit, countLabel);
    }
  }
  switch (q.kind) {
    case "mass":
      return formatMassAuto(q.amount);
    case "volume":
      return formatVolumeAuto(q.amount);
    case "count":
      return formatCountAuto(q.amount, countLabel);
  }
}

/** Preferred display unit under the auto-promotion rules (ignoring overrides). */
export function preferredDisplayUnit(q: CanonicalQuantity): Unit {
  switch (q.kind) {
    case "mass":
      return Math.abs(q.amount) >= 1000 ? "kg" : "g";
    case "volume":
      return Math.abs(q.amount) >= 1000 ? "L" : "ml";
    case "count":
      return CANONICAL_UNIT.count;
  }
}
