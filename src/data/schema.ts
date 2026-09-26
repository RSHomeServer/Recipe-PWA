import type { Transaction } from "dexie";
import type { SongaraSchemaVersion } from "@songara/pwa-base/preview/dexie";
import {
  DEFAULT_CATEGORY_ACCENT,
  DEFAULT_CATEGORY_ICON,
  normalizeIngredientRow,
  normalizeCategoryRow,
  normalizePlanGroupField,
  normalizeRecipeRow,
  normalizeSettingsRow,
  normalizeNutritionDeep,
} from "@/domain";
import { CATEGORY_VISUALS_BY_ID } from "./seeds";
import sodiumIndex from "./starter-pack/sodium-index.json";

/** Current Dexie schema version for Recipe PWA. */
export const RECIPE_SCHEMA_VERSION = 3;

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
 * Complete store map at schema v2 (authoritative for table names through v2).
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

/**
 * Complete store map at schema v3 (authoritative for table names).
 * Indexes added: *flavourTags on ingredients; kind on recipes.
 * Declared complete in ticket 1 even while tags/kind behaviour arrives later
 * (V3_SCOPE — no partial v3).
 */
export const recipeSchemaV3Stores = {
  ingredients: "id, name, categoryId, archivedAt, *flavourTags",
  ingredientCategories: "id, sortOrder",
  recipes: "id, name, archivedAt, kind",
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

export type RecipeTableName = keyof typeof recipeSchemaV3Stores;

export const RECIPE_TABLE_NAMES = Object.keys(
  recipeSchemaV3Stores,
) as RecipeTableName[];

/** Dexie v2 delta: only tables whose definition changed from v1. */
const recipeSchemaV2StoreDelta = {
  mealTemplates: recipeSchemaV2Stores.mealTemplates,
  plannedMeals: recipeSchemaV2Stores.plannedMeals,
  loggedMeals: recipeSchemaV2Stores.loggedMeals,
} as const;

/** Dexie v3 delta: only tables whose definition changed from v2. */
const recipeSchemaV3StoreDelta = {
  ingredients: recipeSchemaV3Stores.ingredients,
  recipes: recipeSchemaV3Stores.recipes,
} as const;

type SodiumIndex = Record<string, number>;

const packSodiumIndex = sodiumIndex as SodiumIndex;

function referenceSodiumKey(
  datasetId: unknown,
  entryCode: unknown,
): string | null {
  if (typeof datasetId !== "string" || !datasetId) return null;
  if (typeof entryCode !== "string" || !entryCode) return null;
  return `${datasetId}::${entryCode}`;
}

/**
 * Backfill sodium on untouched reference rows from shipped pack figures (R2.6).
 * Never alters macros or non-reference rows. Batch snapshots are untouched.
 */
function backfillSodiumMg(row: Record<string, unknown>): Record<string, unknown> {
  const source = row.source as Record<string, unknown> | null | undefined;
  const nutrition = row.nutrition as Record<string, unknown> | null | undefined;
  if (!nutrition || typeof nutrition !== "object") return row;

  // Only fill when sodium is absent (pre-v3) — never overwrite an explicit null
  // that a later write may have stored, and never change macros.
  if ("sodiumMg" in nutrition) return row;

  const nextNutrition: Record<string, unknown> = { ...nutrition, sodiumMg: null };

  if (source?.kind === "reference") {
    const key = referenceSodiumKey(source.datasetId, source.entryCode);
    if (key && key in packSodiumIndex) {
      nextNutrition.sodiumMg = packSodiumIndex[key]!;
    }
  }

  return { ...row, nutrition: nextNutrition };
}

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

async function upgradeToV3(tx: Transaction): Promise<void> {
  const ingredients = await tx.table("ingredients").toArray();
  for (const row of ingredients) {
    const normalized = normalizeIngredientRow(row) as Record<string, unknown>;
    // normalizeIngredientRow sets missing sodiumMg to null via normalizeNutrition.
    // For backfill we need the pre-normalize absence — inspect the raw row.
    const rawNutrition = (row as { nutrition?: Record<string, unknown> })
      .nutrition;
    const hadSodium =
      rawNutrition != null &&
      typeof rawNutrition === "object" &&
      "sodiumMg" in rawNutrition;

    let next = normalized;
    if (!hadSodium) {
      // Strip the defensive null so backfillSodiumMg can fill from the pack.
      const nutrition = { ...(normalized.nutrition as Record<string, unknown>) };
      delete nutrition.sodiumMg;
      next = backfillSodiumMg({ ...normalized, nutrition });
    }
    await tx.table("ingredients").put(next);
  }

  const recipes = await tx.table("recipes").toArray();
  for (const row of recipes) {
    await tx.table("recipes").put(normalizeRecipeRow(row));
  }

  // History: add sodiumMg: null on pre-v3 snapshots / custom foods. Never backfill
  // from live ingredients (R2.10 / ADR-007 §7).
  const batches = await tx.table("batches").toArray();
  for (const row of batches) {
    await tx.table("batches").put(normalizeNutritionDeep(row));
  }

  const logged = await tx.table("loggedMeals").toArray();
  for (const row of logged) {
    await tx.table("loggedMeals").put(normalizeNutritionDeep(row));
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
  {
    version: 3,
    stores: { ...recipeSchemaV3StoreDelta },
    upgrade: upgradeToV3,
  },
];
