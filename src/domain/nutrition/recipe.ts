import type { CanonicalQuantity } from "../units/schemas";
import type {
  Nutrition,
  NutritionIngredient,
  RecipeInput,
  RecipeLineInput,
} from "./schemas";
import { nutritionOf, scale, sum } from "./primitives";

export type IngredientsById = Readonly<
  Record<string, NutritionIngredient | undefined>
>;

function requireIngredient(
  ingredientsById: IngredientsById,
  ingredientId: string,
): NutritionIngredient {
  const ing = ingredientsById[ingredientId];
  if (!ing) {
    throw new Error(`Unknown ingredient: ${ingredientId}`);
  }
  return ing;
}

/** Headline recipe total — optional lines excluded. */
export function recipeTotal(
  recipe: RecipeInput,
  ingredientsById: IngredientsById,
): Nutrition {
  return sum(
    recipe.lines
      .filter((l) => !l.optional)
      .map((l) =>
        nutritionOf(requireIngredient(ingredientsById, l.ingredientId), l.quantity),
      ),
  );
}

export function recipePerServing(
  recipe: RecipeInput,
  ingredientsById: IngredientsById,
): Nutrition {
  return scale(recipeTotal(recipe, ingredientsById), 1 / recipe.servings);
}

export type RecipeBreakdownRow = {
  line: RecipeLineInput;
  nutrition: Nutrition;
  /** Share of headline (non-optional) kcal, 0–1. Optional lines use null. */
  shareOfKcal: number | null;
  optional: boolean;
};

/**
 * Per-line breakdown. Optional lines are listed with their contribution but
 * `shareOfKcal` is null; shares of required lines sum to ~1 over headline kcal.
 */
export function recipeBreakdown(
  recipe: RecipeInput,
  ingredientsById: IngredientsById,
): RecipeBreakdownRow[] {
  const total = recipeTotal(recipe, ingredientsById);
  return recipe.lines.map((line) => {
    const nutrition = nutritionOf(
      requireIngredient(ingredientsById, line.ingredientId),
      line.quantity,
    );
    if (line.optional) {
      return { line, nutrition, shareOfKcal: null, optional: true };
    }
    const shareOfKcal =
      total.kcal === 0 ? 0 : nutrition.kcal / total.kcal;
    return { line, nutrition, shareOfKcal, optional: false };
  });
}

export function scaledLines(
  recipe: RecipeInput,
  servings: number,
): RecipeLineInput[] {
  const factor = servings / recipe.servings;
  return recipe.lines.map((line) => ({
    ...line,
    quantity: {
      ...line.quantity,
      amount: line.quantity.amount * factor,
    } satisfies CanonicalQuantity,
  }));
}
