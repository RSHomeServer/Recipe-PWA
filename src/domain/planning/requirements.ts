import type { Ingredient } from "../ingredients/schemas";
import type { Recipe } from "../recipes/schemas";
import type { IsoDate } from "../shared/primitives";
import { toCanonical } from "../units/convert";
import type { CanonicalQuantity } from "../units/schemas";
import { isZero } from "../units/compare";
import type { PlannedMeal } from "./schemas";

export type DateRange = {
  from: IsoDate;
  to: IsoDate;
};

export type PlanRequirementLine = {
  ingredientId: string;
  quantity: CanonicalQuantity;
};

export type PlanRequirementsContext = {
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
};

function inRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

function addCanonical(
  totals: Map<string, CanonicalQuantity>,
  ingredientId: string,
  quantity: CanonicalQuantity,
): void {
  const existing = totals.get(ingredientId);
  if (!existing) {
    totals.set(ingredientId, { ...quantity });
    return;
  }
  if (existing.kind !== quantity.kind) {
    // Programming / data error: keep the first family and ignore the mismatch.
    return;
  }
  totals.set(ingredientId, {
    amount: existing.amount + quantity.amount,
    kind: existing.kind,
  });
}

/**
 * Aggregate ingredient requirements for planned meals in a date range.
 *
 * - `recipeServings` → non-optional lines × (servings ÷ recipe.servings)
 * - `batchPortions` → contributes nothing (food already exists)
 * - `ingredient` → that quantity, converted to canonical
 *
 * Grouped by ingredientId and summed in canonical units. Never persists.
 */
export function requirements(
  meals: readonly PlannedMeal[],
  range: DateRange,
  ctx: PlanRequirementsContext,
): PlanRequirementLine[] {
  const totals = new Map<string, CanonicalQuantity>();

  for (const meal of meals) {
    if (!inRange(meal.date, range)) continue;

    const { entry } = meal;
    if (entry.kind === "batchPortions") continue;

    if (entry.kind === "ingredient") {
      const ingredient = ctx.ingredientsById.get(entry.ingredientId);
      if (!ingredient) continue;
      const converted = toCanonical(entry.quantity, ingredient);
      if (!converted.ok) continue;
      addCanonical(totals, entry.ingredientId, converted.canonical);
      continue;
    }

    // recipeServings
    const recipe = ctx.recipesById.get(entry.recipeId);
    if (!recipe || recipe.servings <= 0) continue;
    const scale = entry.servings / recipe.servings;

    for (const line of recipe.lines) {
      if (line.optional) continue;
      addCanonical(totals, line.ingredientId, {
        amount: line.quantity.amount * scale,
        kind: line.quantity.kind,
      });
    }
  }

  return [...totals.entries()]
    .filter(([, quantity]) => !isZero(quantity.amount, quantity.kind))
    .map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
    .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
}
