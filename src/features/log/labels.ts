import type {
  Ingredient,
  LoggedMeal,
  MealEntry,
  PlannedMeal,
  Recipe,
} from "@/domain";

export function mealEntryLabel(
  entry: MealEntry,
  recipesById: ReadonlyMap<string, Recipe>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
  batchNameById: ReadonlyMap<string, string>,
): { title: string; subtitle: string; variant: "cook" | "portion" | "ingredient" | "custom" } {
  if (entry.kind === "recipeServings") {
    const recipe = recipesById.get(entry.recipeId);
    return {
      variant: "cook",
      title: recipe?.name ?? "Recipe",
      subtitle: `${entry.servings} serving${entry.servings === 1 ? "" : "s"}`,
    };
  }
  if (entry.kind === "batchPortions") {
    return {
      variant: "portion",
      title: batchNameById.get(entry.batchId) ?? "Batch",
      subtitle: `${entry.portions} portion${entry.portions === 1 ? "" : "s"}`,
    };
  }
  if (entry.kind === "ingredient") {
    const ingredient = ingredientsById.get(entry.ingredientId);
    return {
      variant: "ingredient",
      title: ingredient?.name ?? "Ingredient",
      subtitle: `${entry.quantity.value} ${entry.quantity.unit}`,
    };
  }
  return {
    variant: "custom",
    title: entry.food.name,
    subtitle:
      entry.food.quantity === 1
        ? "Custom food"
        : `× ${entry.food.quantity}`,
  };
}

export function loggedMealLabel(
  meal: LoggedMeal,
  recipesById: ReadonlyMap<string, Recipe>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
  batchNameById: ReadonlyMap<string, string>,
) {
  return mealEntryLabel(
    meal.entry,
    recipesById,
    ingredientsById,
    batchNameById,
  );
}

export function plannedMealQuickLabel(
  meal: PlannedMeal,
  recipesById: ReadonlyMap<string, Recipe>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
  batchNameById: ReadonlyMap<string, string>,
) {
  return mealEntryLabel(
    meal.entry,
    recipesById,
    ingredientsById,
    batchNameById,
  );
}
