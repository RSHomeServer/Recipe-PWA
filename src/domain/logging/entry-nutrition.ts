import type { Batch } from "../batches/schemas";
import type { Ingredient } from "../ingredients/schemas";
import {
  portionsNutrition,
  recipeTotal,
  scale,
  nutritionOf,
  type Nutrition,
} from "../nutrition";
import type { Recipe } from "../recipes/schemas";
import type { MealEntry } from "../shared/meal-entry";
import { toCanonical } from "../units/convert";

export type EntryNutritionCtx = {
  recipesById: ReadonlyMap<string, Recipe>;
  batchesById: ReadonlyMap<string, Batch>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
};

export type EntryNutritionResult =
  | { ok: true; nutrition: Nutrition }
  | {
      ok: false;
      reason:
        | "missingRecipe"
        | "missingBatch"
        | "missingIngredient"
        | "wrongFamily";
    };

/**
 * Resolve nutrition for any meal entry (planned or logged).
 * See NUTRITION_MODEL.md §Meal entry nutrition.
 */
export function entryNutrition(
  entry: MealEntry,
  ctx: EntryNutritionCtx,
): EntryNutritionResult {
  switch (entry.kind) {
    case "recipeServings": {
      const recipe = ctx.recipesById.get(entry.recipeId);
      if (!recipe) return { ok: false, reason: "missingRecipe" };
      const ingredientsRecord: Record<string, Ingredient | undefined> = {};
      for (const [id, ingredient] of ctx.ingredientsById) {
        ingredientsRecord[id] = ingredient;
      }
      try {
        const total = recipeTotal(recipe, ingredientsRecord);
        return {
          ok: true,
          nutrition: scale(total, entry.servings / recipe.servings),
        };
      } catch {
        return { ok: false, reason: "missingIngredient" };
      }
    }
    case "batchPortions": {
      const batch = ctx.batchesById.get(entry.batchId);
      if (!batch) return { ok: false, reason: "missingBatch" };
      return {
        ok: true,
        nutrition: portionsNutrition(batch, entry.portions),
      };
    }
    case "ingredient": {
      const ingredient = ctx.ingredientsById.get(entry.ingredientId);
      if (!ingredient) return { ok: false, reason: "missingIngredient" };
      const converted = toCanonical(entry.quantity, ingredient);
      if (!converted.ok) return { ok: false, reason: "wrongFamily" };
      return {
        ok: true,
        nutrition: nutritionOf(ingredient, converted.canonical),
      };
    }
    case "customFood":
      return {
        ok: true,
        nutrition: scale(entry.food.nutrition, entry.food.quantity),
      };
  }
}
