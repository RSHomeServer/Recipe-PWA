import type { Nutrition } from "./schemas";

/** Atwater factors for presentational percent-of-energy only. */
const KCAL_PER_G = { proteinG: 4, carbsG: 4, fatG: 9 } as const;

/** UK adult daily sodium reference (~6 g salt ≈ 2.4 g sodium), as context only. */
export const UK_ADULT_SODIUM_MG_PER_DAY = 2400;

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

/** Sodium mg → integer string when known. */
export function formatSodiumMg(mg: number): string {
  return String(Math.round(mg));
}

/** Salt-equivalent grams from sodium mg (`salt g ≈ sodium mg × 2.5 ÷ 1000`). */
export function saltGramsFromSodiumMg(sodiumMg: number): number {
  return (sodiumMg * 2.5) / 1000;
}

export function formatSaltG(saltG: number): string {
  const rounded = Number(saltG.toFixed(2));
  return trimTrailingZeros(rounded.toFixed(2));
}

export type FormattedNutrition = {
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  /** null when sodium is unknown — never "0" for null. */
  sodiumMg: string | null;
};

export function formatNutrition(n: Nutrition): FormattedNutrition {
  return {
    kcal: formatKcal(n.kcal),
    proteinG: formatMacroG(n.proteinG),
    carbsG: formatMacroG(n.carbsG),
    fatG: formatMacroG(n.fatG),
    sodiumMg: n.sodiumMg === null ? null : formatSodiumMg(n.sodiumMg),
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

export type SodiumDisplay =
  | { kind: "known"; sodiumMg: number; saltG: number; label: string }
  | {
      kind: "partial";
      knownSodiumMg: number;
      saltG: number;
      unknownCount: number;
      totalCount: number;
      label: string;
    }
  | { kind: "unknown"; label: string };

/**
 * R2.7 — three display states for sodium totals.
 * For a single Nutrition total use unknownCount=0 / totalCount=1 when known,
 * or unknownCount=1 when wholly unknown.
 */
export function describeSodium(input: {
  sodiumMg: number | null;
  unknownCount?: number;
  totalCount?: number;
}): SodiumDisplay {
  const unknownCount = input.unknownCount ?? (input.sodiumMg === null ? 1 : 0);
  const totalCount = input.totalCount ?? 1;

  if (input.sodiumMg === null && unknownCount >= totalCount) {
    return { kind: "unknown", label: "Sodium not known" };
  }

  if (input.sodiumMg === null) {
    // Wholly unknown total without contributor counts — treat as unknown.
    return { kind: "unknown", label: "Sodium not known" };
  }

  const saltG = saltGramsFromSodiumMg(input.sodiumMg);
  if (unknownCount > 0) {
    return {
      kind: "partial",
      knownSodiumMg: input.sodiumMg,
      saltG,
      unknownCount,
      totalCount,
      label: `at least ${formatSodiumMg(input.sodiumMg)} mg · ${unknownCount} of ${totalCount} items unknown`,
    };
  }

  return {
    kind: "known",
    sodiumMg: input.sodiumMg,
    saltG,
    label: `${formatSodiumMg(input.sodiumMg)} mg sodium`,
  };
}

/**
 * Summarise sodium across contributor nutritions (e.g. recipe lines, day items).
 * Known total only when every contributor is known; otherwise partial "at least"
 * from the known subset, or wholly unknown.
 */
export function describeSodiumFromContributors(
  contributors: readonly { sodiumMg: number | null }[],
): SodiumDisplay {
  const totalCount = contributors.length;
  if (totalCount === 0) {
    return describeSodium({ sodiumMg: 0, unknownCount: 0, totalCount: 0 });
  }

  let knownSum = 0;
  let unknownCount = 0;
  for (const c of contributors) {
    if (c.sodiumMg === null) unknownCount += 1;
    else knownSum += c.sodiumMg;
  }

  if (unknownCount === totalCount) {
    return { kind: "unknown", label: "Sodium not known" };
  }

  if (unknownCount === 0) {
    return describeSodium({
      sodiumMg: knownSum,
      unknownCount: 0,
      totalCount,
    });
  }

  return describeSodium({
    sodiumMg: knownSum,
    unknownCount,
    totalCount,
  });
}
