import type { Batch } from "../batches/schemas";
import type { Ingredient } from "../ingredients/schemas";
import {
  nutritionOf,
  scale,
  type Nutrition,
} from "../nutrition";
import type { Recipe } from "../recipes/schemas";
import type { LoggedMeal } from "../logging/schemas";
import type { CanonicalQuantity } from "../units/schemas";
import { toCanonical } from "../units/convert";
import type { IsoDate, Id } from "../shared/primitives";

export type ContributionSource = {
  logId: Id;
  date: IsoDate;
  slotId: Id;
  recipeId: Id | null;
  batchId: Id | null;
};

export type Contribution = {
  ingredientId: Id | null;
  ingredientName: string;
  quantity: CanonicalQuantity | null;
  nutrition: Nutrition;
  source: ContributionSource;
};

export type ExpandCtx = {
  recipe: (id: string) => Recipe | undefined;
  batch: (id: string) => Batch | undefined;
  ingredient: (id: string) => Ingredient | undefined;
};

export function expandCtxFromMaps(
  recipesById: ReadonlyMap<string, Recipe>,
  batchesById: ReadonlyMap<string, Batch>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): ExpandCtx {
  return {
    recipe: (id) => recipesById.get(id),
    batch: (id) => batchesById.get(id),
    ingredient: (id) => ingredientsById.get(id),
  };
}

/**
 * Expand a logged meal into ingredient-level contributions.
 * See NUTRITION_MODEL.md §Attribution.
 */
export function expand(log: LoggedMeal, ctx: ExpandCtx): Contribution[] {
  const at = { logId: log.id, date: log.date, slotId: log.slotId };

  switch (log.entry.kind) {
    case "recipeServings": {
      const recipe = ctx.recipe(log.entry.recipeId);
      if (!recipe) return [];
      const f = log.entry.servings / recipe.servings;
      const out: Contribution[] = [];
      for (const line of recipe.lines) {
        if (line.optional) continue;
        const ing = ctx.ingredient(line.ingredientId);
        if (!ing) continue;
        const q: CanonicalQuantity = {
          ...line.quantity,
          amount: line.quantity.amount * f,
        };
        out.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          quantity: q,
          nutrition: nutritionOf(ing, q),
          source: { ...at, recipeId: recipe.id, batchId: null },
        });
      }
      return out;
    }

    case "batchPortions": {
      const batch = ctx.batch(log.entry.batchId);
      if (!batch) return [];
      const f = log.entry.portions / batch.portionsNominal;
      return batch.snapshot.lines.map((line) => ({
        ingredientId: line.ingredientId,
        ingredientName: line.ingredientName,
        quantity: {
          ...line.quantity,
          amount: line.quantity.amount * f,
        },
        nutrition: scale(line.nutrition, f),
        source: {
          ...at,
          recipeId: batch.recipeId,
          batchId: batch.id,
        },
      }));
    }

    case "ingredient": {
      const ing = ctx.ingredient(log.entry.ingredientId);
      if (!ing) return [];
      const converted = toCanonical(log.entry.quantity, ing);
      if (!converted.ok) return [];
      return [
        {
          ingredientId: ing.id,
          ingredientName: ing.name,
          quantity: converted.canonical,
          nutrition: nutritionOf(ing, converted.canonical),
          source: { ...at, recipeId: null, batchId: null },
        },
      ];
    }

    case "customFood":
      return [
        {
          ingredientId: null,
          ingredientName: log.entry.food.name,
          quantity: null,
          nutrition: scale(log.entry.food.nutrition, log.entry.food.quantity),
          source: { ...at, recipeId: null, batchId: null },
        },
      ];
  }
}

/** Expand many logs; skips entries that cannot resolve against ctx. */
export function expandAll(
  logs: readonly LoggedMeal[],
  ctx: ExpandCtx,
): Contribution[] {
  return logs.flatMap((log) => expand(log, ctx));
}
