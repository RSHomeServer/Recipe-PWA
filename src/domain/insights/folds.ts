import { sum, ZERO, type Nutrition } from "../nutrition";
import { weekContaining } from "../planning";
import type { IsoDate } from "../shared/primitives";
import type { Contribution } from "./expand";

export const UNATTRIBUTED_KEY = "__unattributed__";
export const NONE_RECIPE_KEY = "__none__";

export type FoldBucket = {
  key: string;
  /** Display name when known; otherwise equals key. */
  label: string;
  nutrition: Nutrition;
};

function groupSum(
  cs: readonly Contribution[],
  keyOf: (c: Contribution) => string,
  labelOf?: (key: string, sample: Contribution) => string,
): FoldBucket[] {
  const map = new Map<string, { nutrition: Nutrition[]; sample: Contribution }>();
  for (const c of cs) {
    const key = keyOf(c);
    const existing = map.get(key);
    if (existing) {
      existing.nutrition.push(c.nutrition);
    } else {
      map.set(key, { nutrition: [c.nutrition], sample: c });
    }
  }
  const buckets: FoldBucket[] = [];
  for (const [key, { nutrition, sample }] of map) {
    buckets.push({
      key,
      label: labelOf?.(key, sample) ?? key,
      nutrition: sum(nutrition),
    });
  }
  return buckets;
}

export function byDay(cs: readonly Contribution[]): FoldBucket[] {
  return groupSum(cs, (c) => c.source.date).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

export function byMeal(cs: readonly Contribution[]): FoldBucket[] {
  return groupSum(cs, (c) => c.source.slotId);
}

export function byRecipe(cs: readonly Contribution[]): FoldBucket[] {
  return groupSum(
    cs,
    (c) => c.source.recipeId ?? NONE_RECIPE_KEY,
    (key, sample) =>
      key === NONE_RECIPE_KEY ? "No recipe" : (sample.source.recipeId ?? key),
  );
}

export function byIngredient(cs: readonly Contribution[]): FoldBucket[] {
  return groupSum(
    cs,
    (c) => c.ingredientId ?? UNATTRIBUTED_KEY,
    (key, sample) =>
      key === UNATTRIBUTED_KEY ? "Unattributed" : sample.ingredientName,
  );
}

/** Monday-start week key = week `from` IsoDate. */
export function weekKey(date: IsoDate, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): string {
  return weekContaining(date, weekStartsOn).from;
}

export function weekTotals(
  cs: readonly Contribution[],
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
): FoldBucket[] {
  return groupSum(cs, (c) => weekKey(c.source.date, weekStartsOn)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

export function totalNutrition(cs: readonly Contribution[]): Nutrition {
  return sum(cs.map((c) => c.nutrition));
}

/** Distinct calendar days that have at least one contribution. */
export function daysWithAnyLog(cs: readonly Contribution[]): number {
  const days = new Set<string>();
  for (const c of cs) days.add(c.source.date);
  return days.size;
}

/**
 * Weekly average kcal (and macros) = total / daysWithAnyLog — never / 7.
 * Returns ZERO when there are no logged days.
 */
export function weeklyAverage(cs: readonly Contribution[]): {
  average: Nutrition;
  daysWithLogs: number;
  total: Nutrition;
} {
  const total = totalNutrition(cs);
  const daysWithLogs = daysWithAnyLog(cs);
  if (daysWithLogs === 0) {
    return { average: ZERO, daysWithLogs: 0, total };
  }
  return {
    average: {
      kcal: total.kcal / daysWithLogs,
      proteinG: total.proteinG / daysWithLogs,
      carbsG: total.carbsG / daysWithLogs,
      fatG: total.fatG / daysWithLogs,
    },
    daysWithLogs,
    total,
  };
}

export type RankedBucket = FoldBucket & {
  /** True for the rolled-up "other" bucket. */
  isOther?: boolean;
  /** True for custom-food / unattributed. */
  isUnattributed?: boolean;
};

/**
 * Rank by kcal descending. Keep top `limit` attributed rows; roll the rest into "Other".
 * When `keepUnattributed`, the unattributed bucket is always appended separately (never
 * absorbed into Other).
 */
export function rankTop(
  buckets: readonly FoldBucket[],
  limit: number,
  options?: { keepUnattributed?: boolean; otherLabel?: string },
): RankedBucket[] {
  const keepUnattributed = options?.keepUnattributed ?? false;
  const otherLabel = options?.otherLabel ?? "Other";

  let unattributed: FoldBucket | undefined;
  let rest = [...buckets];
  if (keepUnattributed) {
    unattributed = rest.find((b) => b.key === UNATTRIBUTED_KEY);
    rest = rest.filter((b) => b.key !== UNATTRIBUTED_KEY);
  }

  rest.sort((a, b) => b.nutrition.kcal - a.nutrition.kcal || a.label.localeCompare(b.label));

  const top = rest.slice(0, limit);
  const overflow = rest.slice(limit);
  const ranked: RankedBucket[] = top.map((b) => ({ ...b }));

  if (overflow.length > 0) {
    ranked.push({
      key: "__other__",
      label: otherLabel,
      nutrition: sum(overflow.map((b) => b.nutrition)),
      isOther: true,
    });
  }

  if (unattributed && unattributed.nutrition.kcal > 0) {
    ranked.push({
      ...unattributed,
      label: "Unattributed",
      isUnattributed: true,
    });
  }

  return ranked;
}

/** Sum kcal across fold buckets (for reconciliation). */
export function foldKcalTotal(buckets: readonly FoldBucket[]): number {
  return buckets.reduce((acc, b) => acc + b.nutrition.kcal, 0);
}
