export {
  NutritionSchema,
  NutritionIngredientSchema,
  RecipeLineInputSchema,
  RecipeInputSchema,
  BatchSnapshotLineSchema,
  BatchSnapshotSchema,
  BatchNutritionInputSchema,
  normalizeNutrition,
  normalizeNutritionDeep,
} from "./schemas";
export type {
  Nutrition,
  NutritionIngredient,
  RecipeLineInput,
  RecipeInput,
  BatchSnapshotLine,
  BatchSnapshot,
  BatchNutritionInput,
} from "./schemas";

export { ZERO, basis, scale, sum, nutritionOf } from "./primitives";

export {
  recipeTotal,
  recipePerServing,
  recipeBreakdown,
  scaledLines,
} from "./recipe";
export type { IngredientsById, RecipeBreakdownRow } from "./recipe";

export {
  createSnapshot,
  seedActualLines,
  batchNutrition,
  portionNutrition,
  portionsNutrition,
} from "./batch";
export type { SnapshotActualLine } from "./batch";

export {
  formatKcal,
  formatMacroG,
  formatPct,
  formatNutrition,
  formatSodiumMg,
  formatSaltG,
  saltGramsFromSodiumMg,
  describeSodium,
  describeSodiumFromContributors,
  macroEnergyShare,
  UK_ADULT_SODIUM_MG_PER_DAY,
} from "./format";
export type { FormattedNutrition, SodiumDisplay } from "./format";
