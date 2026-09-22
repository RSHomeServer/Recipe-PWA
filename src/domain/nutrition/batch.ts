import type { CanonicalQuantity } from "../units/schemas";
import type {
  BatchNutritionInput,
  BatchSnapshot,
  Nutrition,
  RecipeInput,
} from "./schemas";
import type { IngredientsById } from "./recipe";
import { scaledLines } from "./recipe";
import { nutritionOf, scale, sum } from "./primitives";

export type SnapshotActualLine = {
  ingredientId: string;
  quantity: CanonicalQuantity;
};

/**
 * Build an immutable batch snapshot from actual cook quantities.
 * `actualLines` are typically seeded from `scaledLines(recipe, servings × scale)`.
 */
export function createSnapshot(
  recipe: Pick<RecipeInput, "name">,
  ingredientsById: IngredientsById,
  actualLines: readonly SnapshotActualLine[],
): BatchSnapshot {
  const lines = actualLines.map((l) => {
    const ing = ingredientsById[l.ingredientId];
    if (!ing) {
      throw new Error(`Unknown ingredient: ${l.ingredientId}`);
    }
    return {
      ingredientId: ing.id,
      ingredientName: ing.name,
      quantity: l.quantity,
      nutrition: nutritionOf(ing, l.quantity),
    };
  });
  return {
    recipeName: recipe.name,
    lines,
    total: sum(lines.map((l) => l.nutrition)),
  };
}

/** Seed actual lines from a recipe scale factor (before cook-flow edits). */
export function seedActualLines(
  recipe: RecipeInput,
  scaleFactor: number,
): SnapshotActualLine[] {
  return scaledLines(recipe, recipe.servings * scaleFactor).map((l) => ({
    ingredientId: l.ingredientId,
    quantity: l.quantity,
  }));
}

export function batchNutrition(batch: BatchNutritionInput): Nutrition {
  return batch.snapshot.total;
}

export function portionNutrition(batch: BatchNutritionInput): Nutrition {
  return scale(batch.snapshot.total, 1 / batch.portionsNominal);
}

export function portionsNutrition(
  batch: BatchNutritionInput,
  portions: number,
): Nutrition {
  return scale(batch.snapshot.total, portions / batch.portionsNominal);
}
