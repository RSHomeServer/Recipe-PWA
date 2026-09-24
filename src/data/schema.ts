import type { Transaction } from "dexie";
import type { SongaraSchemaVersion } from "@songara/pwa-base/preview/dexie";
import {
  DEFAULT_CATEGORY_ACCENT,
  DEFAULT_CATEGORY_ICON,
  normalizeIngredientRow,
  normalizeCategoryRow,
  normalizePlanGroupField,
  normalizeSettingsRow,
} from "@/domain";
import { CATEGORY_VISUALS_BY_ID } from "./seeds";

/** Current Dexie schema version for Recipe PWA. */
export const RECIPE_SCHEMA_VERSION = 2;

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
  /**
   * Stores image Blobs for recipes and (from v2) ingredients.
   * Name is historical — renaming would copy binary rows in upgrade() for no
   * functional gain. See ADR-002 §3 / V2_SCOPE Dexie schema version 2.
   */
  recipeImages: "id",
  batches: "id, recipeId, cookedAt, closedAt",
  pantryStock: "ingredientId, updatedAt",
  mealSlots: "id, sortOrder",
  plannedMeals: "id, date, [date+slotId]",
  loggedMeals: "id, date, [date+slotId], plannedMealId",
  shoppingOverlays: "id, windowKey",
  settings: "id",
} as const;

/**
 * Complete store map at schema v2 (authoritative for table names).
 * Indexes added: mealTemplates table; group.id on planned/logged meals.
 */
export const recipeSchemaV2Stores = {
  ingredients: "id, name, categoryId, archivedAt",
  ingredientCategories: "id, sortOrder",
  recipes: "id, name, archivedAt",
  /**
   * Stores image Blobs for recipes and ingredients.
   * Name is historical — do not rename (ADR-002 §3 / V2_SCOPE).
   */
  recipeImages: "id",
  batches: "id, recipeId, cookedAt, closedAt",
  pantryStock: "ingredientId, updatedAt",
  mealSlots: "id, sortOrder",
  mealTemplates: "id, name, archivedAt",
  plannedMeals: "id, date, [date+slotId], group.id",
  loggedMeals: "id, date, [date+slotId], plannedMealId, group.id",
  shoppingOverlays: "id, windowKey",
  settings: "id",
} as const;

export type RecipeTableName = keyof typeof recipeSchemaV2Stores;

export const RECIPE_TABLE_NAMES = Object.keys(
  recipeSchemaV2Stores,
) as RecipeTableName[];

/** Dexie v2 delta: only tables whose definition changed from v1. */
const recipeSchemaV2StoreDelta = {
  mealTemplates: recipeSchemaV2Stores.mealTemplates,
  plannedMeals: recipeSchemaV2Stores.plannedMeals,
  loggedMeals: recipeSchemaV2Stores.loggedMeals,
} as const;

async function upgradeToV2(tx: Transaction): Promise<void> {
  const ingredients = await tx.table("ingredients").toArray();
  for (const row of ingredients) {
    await tx.table("ingredients").put(normalizeIngredientRow(row));
  }

  const categories = await tx.table("ingredientCategories").toArray();
  for (const row of categories) {
    const record = row as { id?: string };
    const visual =
      record.id && CATEGORY_VISUALS_BY_ID[record.id]
        ? CATEGORY_VISUALS_BY_ID[record.id]
        : { icon: DEFAULT_CATEGORY_ICON, accent: DEFAULT_CATEGORY_ACCENT };
    const base = normalizeCategoryRow(row) as Record<string, unknown>;
    if (
      base.icon === DEFAULT_CATEGORY_ICON &&
      base.accent === DEFAULT_CATEGORY_ACCENT &&
      visual
    ) {
      base.icon = visual.icon;
      base.accent = visual.accent;
    }
    await tx.table("ingredientCategories").put(base);
  }

  const planned = await tx.table("plannedMeals").toArray();
  for (const row of planned) {
    await tx.table("plannedMeals").put(normalizePlanGroupField(row));
  }

  const logged = await tx.table("loggedMeals").toArray();
  for (const row of logged) {
    await tx.table("loggedMeals").put(normalizePlanGroupField(row));
  }

  const settingsRows = await tx.table("settings").toArray();
  for (const row of settingsRows) {
    await tx.table("settings").put(normalizeSettingsRow(row));
  }
}

export const recipeSchemaVersions: readonly SongaraSchemaVersion[] = [
  {
    version: 1,
    stores: { ...recipeSchemaV1Stores },
  },
  {
    version: 2,
    stores: { ...recipeSchemaV2StoreDelta },
    upgrade: upgradeToV2,
  },
];
