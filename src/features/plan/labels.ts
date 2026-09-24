import type {
  Ingredient,
  MealSlot,
  PlannedMeal,
  Recipe,
} from "@/domain";

export function planEntryLabel(
  entry: PlannedMeal["entry"],
  recipesById: ReadonlyMap<string, Recipe>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
  batchNameById: ReadonlyMap<string, string>,
): { title: string; subtitle: string; variant: "cook" | "portion" | "ingredient" } {
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
  const ingredient = ingredientsById.get(entry.ingredientId);
  return {
    variant: "ingredient",
    title: ingredient?.name ?? "Ingredient",
    subtitle: `${entry.quantity.value} ${entry.quantity.unit}`,
  };
}

export function plannedMealLabel(
  meal: PlannedMeal,
  recipesById: ReadonlyMap<string, Recipe>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
  batchNameById: ReadonlyMap<string, string>,
): { title: string; subtitle: string; variant: "cook" | "portion" | "ingredient" } {
  return planEntryLabel(
    meal.entry,
    recipesById,
    ingredientsById,
    batchNameById,
  );
}

export function moveTargetOptions(
  dates: readonly string[],
  slots: readonly MealSlot[],
  formatDay: (iso: string) => string,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (const date of dates) {
    for (const slot of slots) {
      options.push({
        value: `${date}|${slot.id}`,
        label: `${formatDay(date)} · ${slot.name}`,
      });
    }
  }
  return options;
}
