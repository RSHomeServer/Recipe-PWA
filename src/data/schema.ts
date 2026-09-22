import type { SongaraSchemaVersion } from "@songara/pwa-base/preview/dexie";

/** Current Dexie schema version for Recipe PWA. */
export const RECIPE_SCHEMA_VERSION = 1;

export const RECIPE_APP_ID = "recipe";
export const RECIPE_DB_KEY = "app";

/**
 * Dexie store definitions for schema v1.
 * Compound indexes use Dexie `[date+slotId]` syntax.
 */
export const recipeSchemaV1Stores = {
  ingredients: "id, name, categoryId, archivedAt",
  ingredientCategories: "id, sortOrder",
  recipes: "id, name, archivedAt",
  recipeImages: "id",
  batches: "id, recipeId, cookedAt, closedAt",
  pantryStock: "ingredientId, updatedAt",
  mealSlots: "id, sortOrder",
  plannedMeals: "id, date, [date+slotId]",
  loggedMeals: "id, date, [date+slotId], plannedMealId",
  shoppingOverlays: "id, windowKey",
  settings: "id",
} as const;

export type RecipeTableName = keyof typeof recipeSchemaV1Stores;

export const RECIPE_TABLE_NAMES = Object.keys(
  recipeSchemaV1Stores,
) as RecipeTableName[];

export const recipeSchemaVersions: readonly SongaraSchemaVersion[] = [
  {
    version: RECIPE_SCHEMA_VERSION,
    stores: { ...recipeSchemaV1Stores },
  },
];
