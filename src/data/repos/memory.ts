import type { z } from "zod";
import {
  BatchSchema,
  IngredientCategorySchema,
  IngredientSchema,
  LoggedMealSchema,
  MealSlotSchema,
  PantryStockSchema,
  PlannedMealSchema,
  RecipeImageSchema,
  RecipeSchema,
  SettingsSchema,
  ShoppingOverlaySchema,
  normalizeSettingsRow,
  type Batch,
  type BatchUpdate,
  type Ingredient,
  type IngredientCategory,
  type LoggedMeal,
  type MealSlot,
  type PantryStock,
  type PlannedMeal,
  type Recipe,
  type RecipeImage,
  type Settings,
  type ShoppingOverlay,
} from "@/domain";
import { DEFAULT_SETTINGS } from "@/domain";
import { parseRow, parseRows } from "../parse";
import { assertSnapshotUnchanged, prepareIngredientPut } from "./snapshot-guard";
import type {
  BatchRepo,
  IngredientCategoryRepo,
  IngredientRepo,
  LoggedMealRepo,
  MealSlotRepo,
  PantryStockRepo,
  PlannedMealRepo,
  RecipeImageRepo,
  RecipeRepo,
  RecipeRepositories,
  SettingsRepo,
  ShoppingOverlayRepo,
} from "./types";

function mapStore<T>(
  store: Map<string, unknown>,
  schema: z.ZodType<T>,
  table: string,
): T[] {
  return parseRows(schema, table, [...store.values()], (row) => {
    const r = row as { id?: string; ingredientId?: string };
    return r.id ?? r.ingredientId;
  });
}

export function createMemoryRepositories(
  seed?: Partial<{
    ingredients: Ingredient[];
    ingredientCategories: IngredientCategory[];
    recipes: Recipe[];
    recipeImages: RecipeImage[];
    batches: Batch[];
    pantryStock: PantryStock[];
    mealSlots: MealSlot[];
    plannedMeals: PlannedMeal[];
    loggedMeals: LoggedMeal[];
    shoppingOverlays: ShoppingOverlay[];
    settings: Settings;
  }>,
): RecipeRepositories {
  const ingredients = new Map(
    (seed?.ingredients ?? []).map((r) => [r.id, r as unknown]),
  );
  const ingredientCategories = new Map(
    (seed?.ingredientCategories ?? []).map((r) => [r.id, r as unknown]),
  );
  const recipes = new Map(
    (seed?.recipes ?? []).map((r) => [r.id, r as unknown]),
  );
  const recipeImages = new Map(
    (seed?.recipeImages ?? []).map((r) => [r.id, r as unknown]),
  );
  const batches = new Map(
    (seed?.batches ?? []).map((r) => [r.id, r as unknown]),
  );
  const pantryStock = new Map(
    (seed?.pantryStock ?? []).map((r) => [r.ingredientId, r as unknown]),
  );
  const mealSlots = new Map(
    (seed?.mealSlots ?? []).map((r) => [r.id, r as unknown]),
  );
  const plannedMeals = new Map(
    (seed?.plannedMeals ?? []).map((r) => [r.id, r as unknown]),
  );
  const loggedMeals = new Map(
    (seed?.loggedMeals ?? []).map((r) => [r.id, r as unknown]),
  );
  const shoppingOverlays = new Map(
    (seed?.shoppingOverlays ?? []).map((r) => [r.id, r as unknown]),
  );
  let settingsRow: unknown = seed?.settings ?? { ...DEFAULT_SETTINGS };

  const ingredientRepo: IngredientRepo = {
    async all() {
      return mapStore(ingredients, IngredientSchema, "ingredients");
    },
    async byId(id) {
      const row = ingredients.get(id);
      return row
        ? parseRow(IngredientSchema, "ingredients", row, id)
        : undefined;
    },
    async put(row) {
      const parsed = IngredientSchema.parse(row);
      const existing = ingredients.has(parsed.id)
        ? parseRow(
            IngredientSchema,
            "ingredients",
            ingredients.get(parsed.id),
            parsed.id,
          )
        : undefined;
      const prepared = prepareIngredientPut(existing, parsed);
      ingredients.set(prepared.id, prepared);
    },
    async archive(id, archivedAt) {
      const existing = await this.byId(id);
      if (!existing) throw new Error(`Ingredient ${id} not found`);
      ingredients.set(id, { ...existing, archivedAt });
    },
  };

  const ingredientCategoryRepo: IngredientCategoryRepo = {
    async all() {
      return mapStore(
        ingredientCategories,
        IngredientCategorySchema,
        "ingredientCategories",
      );
    },
    async byId(id) {
      const row = ingredientCategories.get(id);
      return row
        ? parseRow(
            IngredientCategorySchema,
            "ingredientCategories",
            row,
            id,
          )
        : undefined;
    },
    async put(row) {
      const parsed = IngredientCategorySchema.parse(row);
      ingredientCategories.set(parsed.id, parsed);
    },
    async delete(id) {
      ingredientCategories.delete(id);
    },
  };

  const recipeRepo: RecipeRepo = {
    async all() {
      return mapStore(recipes, RecipeSchema, "recipes");
    },
    async byId(id) {
      const row = recipes.get(id);
      return row ? parseRow(RecipeSchema, "recipes", row, id) : undefined;
    },
    async put(row) {
      const parsed = RecipeSchema.parse(row);
      recipes.set(parsed.id, parsed);
    },
    async archive(id, archivedAt) {
      const existing = await this.byId(id);
      if (!existing) throw new Error(`Recipe ${id} not found`);
      recipes.set(id, { ...existing, archivedAt });
    },
  };

  const recipeImageRepo: RecipeImageRepo = {
    async byId(id) {
      const row = recipeImages.get(id);
      return row
        ? parseRow(RecipeImageSchema, "recipeImages", row, id)
        : undefined;
    },
    async put(row) {
      const parsed = RecipeImageSchema.parse(row);
      recipeImages.set(parsed.id, parsed);
    },
    async delete(id) {
      recipeImages.delete(id);
    },
  };

  const batchRepo: BatchRepo = {
    async all() {
      return mapStore(batches, BatchSchema, "batches");
    },
    async byId(id) {
      const row = batches.get(id);
      return row ? parseRow(BatchSchema, "batches", row, id) : undefined;
    },
    async byRecipeId(recipeId) {
      const all = await this.all();
      return all.filter((b) => b.recipeId === recipeId);
    },
    async create(row) {
      const parsed = BatchSchema.parse(row);
      if (batches.has(parsed.id)) {
        throw new Error(`Batch ${parsed.id} already exists`);
      }
      batches.set(parsed.id, parsed);
    },
    async update(id, patch: BatchUpdate) {
      if (
        patch !== null &&
        typeof patch === "object" &&
        "snapshot" in (patch as object)
      ) {
        throw new Error(
          `Batch.snapshot cannot be updated (batch ${id})`,
        );
      }
      const existing = await this.byId(id);
      if (!existing) throw new Error(`Batch ${id} not found`);
      const next = BatchSchema.parse({ ...existing, ...patch, id });
      assertSnapshotUnchanged(existing, next.snapshot);
      batches.set(id, next);
    },
    async put(row) {
      const parsed = BatchSchema.parse(row);
      const existing = await this.byId(parsed.id);
      if (existing) {
        assertSnapshotUnchanged(existing, parsed.snapshot);
      }
      batches.set(parsed.id, parsed);
    },
  };

  const pantryStockRepo: PantryStockRepo = {
    async all() {
      return mapStore(pantryStock, PantryStockSchema, "pantryStock");
    },
    async byIngredientId(ingredientId) {
      const row = pantryStock.get(ingredientId);
      return row
        ? parseRow(PantryStockSchema, "pantryStock", row, ingredientId)
        : undefined;
    },
    async put(row) {
      const parsed = PantryStockSchema.parse(row);
      pantryStock.set(parsed.ingredientId, parsed);
    },
    async delete(ingredientId) {
      pantryStock.delete(ingredientId);
    },
  };

  const mealSlotRepo: MealSlotRepo = {
    async all() {
      return mapStore(mealSlots, MealSlotSchema, "mealSlots");
    },
    async byId(id) {
      const row = mealSlots.get(id);
      return row ? parseRow(MealSlotSchema, "mealSlots", row, id) : undefined;
    },
    async put(row) {
      const parsed = MealSlotSchema.parse(row);
      mealSlots.set(parsed.id, parsed);
    },
    async delete(id) {
      mealSlots.delete(id);
    },
  };

  const plannedMealRepo: PlannedMealRepo = {
    async all() {
      return mapStore(plannedMeals, PlannedMealSchema, "plannedMeals");
    },
    async byId(id) {
      const row = plannedMeals.get(id);
      return row
        ? parseRow(PlannedMealSchema, "plannedMeals", row, id)
        : undefined;
    },
    async byDate(date) {
      const all = await this.all();
      return all.filter((m) => m.date === date);
    },
    async put(row) {
      const parsed = PlannedMealSchema.parse(row);
      plannedMeals.set(parsed.id, parsed);
    },
    async delete(id) {
      plannedMeals.delete(id);
    },
  };

  const loggedMealRepo: LoggedMealRepo = {
    async all() {
      return mapStore(loggedMeals, LoggedMealSchema, "loggedMeals");
    },
    async byId(id) {
      const row = loggedMeals.get(id);
      return row
        ? parseRow(LoggedMealSchema, "loggedMeals", row, id)
        : undefined;
    },
    async byDate(date) {
      const all = await this.all();
      return all.filter((m) => m.date === date);
    },
    async put(row) {
      const parsed = LoggedMealSchema.parse(row);
      loggedMeals.set(parsed.id, parsed);
    },
    async delete(id) {
      loggedMeals.delete(id);
    },
  };

  const shoppingOverlayRepo: ShoppingOverlayRepo = {
    async all() {
      return mapStore(
        shoppingOverlays,
        ShoppingOverlaySchema,
        "shoppingOverlays",
      );
    },
    async byId(id) {
      const row = shoppingOverlays.get(id);
      return row
        ? parseRow(ShoppingOverlaySchema, "shoppingOverlays", row, id)
        : undefined;
    },
    async byWindowKey(windowKey) {
      const all = await this.all();
      return all.find((o) => o.windowKey === windowKey);
    },
    async put(row) {
      const parsed = ShoppingOverlaySchema.parse(row);
      shoppingOverlays.set(parsed.id, parsed);
    },
    async delete(id) {
      shoppingOverlays.delete(id);
    },
  };

  const settingsRepo: SettingsRepo = {
    async get() {
      return parseRow(
        SettingsSchema,
        "settings",
        normalizeSettingsRow(settingsRow),
        "singleton",
      );
    },
    async put(row) {
      settingsRow = SettingsSchema.parse(row);
    },
  };

  return {
    ingredients: ingredientRepo,
    ingredientCategories: ingredientCategoryRepo,
    recipes: recipeRepo,
    recipeImages: recipeImageRepo,
    batches: batchRepo,
    pantryStock: pantryStockRepo,
    mealSlots: mealSlotRepo,
    plannedMeals: plannedMealRepo,
    loggedMeals: loggedMealRepo,
    shoppingOverlays: shoppingOverlayRepo,
    settings: settingsRepo,
  };
}
