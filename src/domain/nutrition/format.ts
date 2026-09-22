import type { Nutrition } from "./schemas";

/** Atwater factors for presentational percent-of-energy only. */
const KCAL_PER_G = { proteinG: 4, carbsG: 4, fatG: 9 } as const;

function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/** Calories → integer string, e.g. `524`. */
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal));
}

/** Macros → 1 decimal place, e.g. `42.4`. */
export function formatMacroG(grams: number): string {
  const rounded = Number(grams.toFixed(1));
  return trimTrailingZeros(rounded.toFixed(1));
}

/** Percentages → integer, e.g. `45`. */
export function formatPct(fraction: number): string {
  return String(Math.round(fraction * 100));
}

export type FormattedNutrition = {
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

export function formatNutrition(n: Nutrition): FormattedNutrition {
  return {
    kcal: formatKcal(n.kcal),
    proteinG: formatMacroG(n.proteinG),
    carbsG: formatMacroG(n.carbsG),
    fatG: formatMacroG(n.fatG),
  };
}

/**
 * Approximate percent of energy from a macro using Atwater factors.
 * Guarded against kcal === 0; not normalised to 100%.
 */
export function macroEnergyShare(
  n: Nutrition,
  macro: "proteinG" | "carbsG" | "fatG",
): number {
  if (n.kcal === 0) return 0;
  return (n[macro] * KCAL_PER_G[macro]) / n.kcal;
}
