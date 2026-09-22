import type { LoggedMeal } from "../logging/schemas";
import type { PantryStock } from "../pantry/schemas";
import type { PlannedMeal } from "../planning/schemas";
import type { Recipe } from "../recipes/schemas";
import type { MealEntry, PlanMealEntry } from "../shared/meal-entry";

function entryReferencesIngredient(
  entry: MealEntry | PlanMealEntry,
  ingredientId: string,
): boolean {
  return entry.kind === "ingredient" && entry.ingredientId === ingredientId;
}

/**
 * True when measureKind must stay immutable: any recipe line, pantry row,
 * planned meal, or logged meal references this ingredient (DOMAIN_MODEL).
 */
export function isIngredientReferenced(
  ingredientId: string,
  ctx: {
    recipes: readonly Recipe[];
    pantry: readonly PantryStock[];
    plannedMeals: readonly PlannedMeal[];
    loggedMeals: readonly LoggedMeal[];
  },
): boolean {
  if (ctx.pantry.some((row) => row.ingredientId === ingredientId)) {
    return true;
  }

  if (
    ctx.recipes.some((recipe) =>
      recipe.lines.some((line) => line.ingredientId === ingredientId),
    )
  ) {
    return true;
  }

  if (
    ctx.plannedMeals.some((meal) =>
      entryReferencesIngredient(meal.entry, ingredientId),
    )
  ) {
    return true;
  }

  if (
    ctx.loggedMeals.some((meal) =>
      entryReferencesIngredient(meal.entry, ingredientId),
    )
  ) {
    return true;
  }

  return false;
}
